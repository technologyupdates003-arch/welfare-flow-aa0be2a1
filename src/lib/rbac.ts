// Role-Based Access Control Configuration

export type UserRole = 
  | "admin" 
  | "chairperson" 
  | "vice_chairperson" 
  | "secretary" 
  | "vice_secretary" 
  | "patron" 
  | "member" 
  | "super_admin"
  | "treasurer"
  | "user";

export interface RoleConfig {
  label: string;
  color: string;
  dashboardItems: string[];
  permissions: string[];
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  super_admin: {
    label: "Super Admin",
    color: "bg-red-600",
    dashboardItems: [
      "dashboard",
      "members",
      "contributions",
      "payments",
      "news",
      "events",
      "settings",
      "admin",
      "system",
    ],
    permissions: ["*"],
  },
  admin: {
    label: "Administrator",
    color: "bg-red-500",
    dashboardItems: [
      "dashboard",
      "members",
      "contributions",
      "payments",
      "news",
      "events",
      "settings",
    ],
    permissions: [
      "manage_members",
      "manage_contributions",
      "manage_payments",
      "manage_news",
      "manage_events",
      "view_reports",
    ],
  },
  chairperson: {
    label: "Chairperson",
    color: "bg-blue-600",
    dashboardItems: [
      "dashboard",
      "members",
      "minutes",
      "approvals",
      "news",
    ],
    permissions: [
      "view_members",
      "approve_minutes",
      "view_reports",
      "manage_news",
    ],
  },
  secretary: {
    label: "Secretary",
    color: "bg-green-600",
    dashboardItems: [
      "dashboard",
      "members",
      "minutes",
      "records",
      "news",
    ],
    permissions: [
      "view_members",
      "create_minutes",
      "manage_records",
      "view_reports",
    ],
  },
  vice_chairperson: {
    label: "Vice Chairperson",
    color: "bg-blue-500",
    dashboardItems: [
      "dashboard",
      "members",
      "news",
    ],
    permissions: [
      "view_members",
      "view_reports",
    ],
  },
  vice_secretary: {
    label: "Vice Secretary",
    color: "bg-green-500",
    dashboardItems: [
      "dashboard",
      "members",
      "records",
      "news",
    ],
    permissions: [
      "view_members",
      "manage_records",
    ],
  },
  patron: {
    label: "Patron",
    color: "bg-purple-500",
    dashboardItems: [
      "dashboard",
      "news",
    ],
    permissions: [
      "view_reports",
    ],
  },
  member: {
    label: "Member",
    color: "bg-gray-500",
    dashboardItems: [
      "dashboard",
      "profile",
      "contributions",
      "news",
    ],
    permissions: [
      "view_own_profile",
      "view_own_contributions",
    ],
  },
};

export function hasPermission(role: UserRole | null, permission: string): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  
  const config = ROLE_CONFIG[role];
  if (!config) return false;
  
  return config.permissions.includes("*") || config.permissions.includes(permission);
}

export function canAccessDashboard(role: UserRole | null, dashboardItem: string): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  
  const config = ROLE_CONFIG[role];
  if (!config) return false;
  
  return config.dashboardItems.includes(dashboardItem);
}

export function getRoleColor(role: UserRole | null): string {
  if (!role) return "bg-gray-400";
  return ROLE_CONFIG[role]?.color || "bg-gray-400";
}

export function getRoleLabel(role: UserRole | null): string {
  if (!role) return "No Role";
  return ROLE_CONFIG[role]?.label || role;
}
