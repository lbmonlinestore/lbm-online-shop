import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond(401, { error: "Please sign in again before requesting account deletion." });

  let body: { confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return respond(400, { error: "Invalid request." });
  }

  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return respond(400, { error: "The deletion confirmation phrase is incorrect." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: "Account deletion is not configured. Please contact LBM support." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return respond(401, { error: "Your session could not be verified. Please sign in again." });

  // Never allow this customer endpoint to delete an LBM administrator account.
  const { data: adminRecord, error: adminCheckError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminCheckError) return respond(500, { error: "We could not verify account permissions." });
  if (adminRecord) return respond(403, { error: "Administrator accounts cannot be deleted through the customer dashboard." });

  // A plan must be fulfilled or formally cancelled before the account can be deleted.
  const { data: plans, error: plansError } = await admin
    .from("lay_bay_plans")
    .select("id, plan_status")
    .eq("user_id", user.id);

  if (plansError) return respond(500, { error: "We could not check your Lay-Bay plans. Please try again." });

  const unsettledPlans = (plans || []).filter((plan: { plan_status: string }) =>
    !["fulfilled", "cancelled", "unavailable"].includes(plan.plan_status)
  );

  if (unsettledPlans.length) {
    return respond(409, {
      error: "Account deletion is unavailable while you have a plan that is not yet fulfilled or formally cancelled. Please complete collection or resolve the plan with LBM first."
    });
  }

  const { count: pendingDeposits, error: depositsError } = await admin
    .from("lay_bay_deposits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("verification_status", "pending");

  if (depositsError) return respond(500, { error: "We could not check pending deposits. Please try again." });
  if ((pendingDeposits || 0) > 0) {
    return respond(409, { error: "Please wait until all submitted deposits have been reviewed before deleting your account." });
  }

  const { count: openRefunds, error: refundsError } = await admin
    .from("lay_bay_refunds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("request_status", ["pending", "under_review", "approved", "processing"]);

  if (refundsError) return respond(500, { error: "We could not check refund requests. Please try again." });
  if ((openRefunds || 0) > 0) {
    return respond(409, { error: "Please wait until all refunds have been resolved before deleting your account." });
  }

  const { count: pendingExtensions, error: extensionsError } = await admin
    .from("lay_bay_extension_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("request_status", "pending");

  if (extensionsError) return respond(500, { error: "We could not check extension requests. Please try again." });
  if ((pendingExtensions || 0) > 0) {
    return respond(409, { error: "Please wait until pending extension requests have been reviewed before deleting your account." });
  }

  // Remove objects owned by this user first; Supabase Auth refuses deletion while
  // the user still owns Storage objects.
  const storage = admin.schema("storage");
  const { data: objects, error: storageListError } = await storage
    .from("objects")
    .select("bucket_id, name")
    .or(`owner.eq.${user.id},owner_id.eq.${user.id}`);

  if (storageListError) {
    return respond(500, { error: "We could not prepare your uploaded files for deletion. Please contact LBM support." });
  }

  const grouped = new Map<string, string[]>();
  for (const object of objects || []) {
    if (!grouped.has(object.bucket_id)) grouped.set(object.bucket_id, []);
    grouped.get(object.bucket_id)!.push(object.name);
  }

  for (const [bucket, paths] of grouped.entries()) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      return respond(500, { error: "We could not remove all personal uploads. Your account has not been deleted; please contact LBM support." });
    }
  }

  // Revoke refresh tokens for all devices before removing the Auth user.
  const { error: signOutError } = await userClient.auth.signOut({ scope: "global" });
  if (signOutError) {
    return respond(500, { error: "We could not safely close your active sessions. Your account has not been deleted; please try again." });
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return respond(500, { error: "Your sign-in account could not be deleted. Please contact LBM support." });
  }

  // Keep payment, receipt, ledger and audit records for legitimate business
  // recordkeeping. Remove the customer-facing profile record and its identifiers.
  const { error: profileDeleteError } = await admin
    .from("lay_bay_profiles")
    .delete()
    .eq("user_id", user.id);

  if (profileDeleteError) {
    console.error("Account deleted but profile cleanup needs attention:", profileDeleteError.message);
    return respond(200, {
      success: true,
      message: "Your sign-in account has been deleted. Some profile information needs additional cleanup by LBM support."
    });
  }

  return respond(200, {
    success: true,
    message: "Your Lay-Bay sign-in account and eligible profile information have been deleted. Required financial and audit records remain with LBM."
  });
});
