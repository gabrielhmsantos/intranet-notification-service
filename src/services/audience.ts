import type { SupabaseClient } from "@supabase/supabase-js";

type AudienceInput = {
  type: "company" | "department" | "employees";
  departmentId?: string | null;
  employeeIds?: string[];
};

export async function resolveRecipientUserIds(
  supabase: SupabaseClient,
  tenantId: string,
  audience: AudienceInput,
): Promise<string[]> {
  if (audience.type === "company") {
    const { data } = await supabase
      .from("employees")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .not("user_id", "is", null);
    return uniqueUserIds((data ?? []).map((row) => row.user_id as string));
  }

  if (audience.type === "department") {
    if (!audience.departmentId) return [];
    const { data } = await supabase
      .from("employees")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("department_id", audience.departmentId)
      .not("user_id", "is", null);
    return uniqueUserIds((data ?? []).map((row) => row.user_id as string));
  }

  const ids = audience.employeeIds ?? [];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("employees")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("id", ids)
    .not("user_id", "is", null);

  return uniqueUserIds((data ?? []).map((row) => row.user_id as string));
}

export async function loadEmployeeIdsForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("event_audience_employees")
    .select("employee_id")
    .eq("event_id", eventId);
  return (data ?? []).map((row) => row.employee_id as string);
}

function uniqueUserIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
