"use client";

import { LogOut } from "lucide-react";

export default function SidebarLogoutClient() {
  return (
    <form action="/api/auth/logout" method="post" className="mt-auto pt-4">
      <button type="submit" className="ll_side_link w-full">
        <span className="ll_side_icon" aria-hidden="true">
          <LogOut size={18} />
        </span>
        <span className="ll_side_label">Logout</span>
      </button>
    </form>
  );
}
