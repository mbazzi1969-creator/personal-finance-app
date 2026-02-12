"use client";
import { useEffect, useState } from "react";
export function useActiveOrgId() {
  const [orgId, setOrgId] = useState<string>("");
  useEffect(() => { setOrgId(localStorage.getItem("active_org_id") || ""); }, []);
  return orgId;
}
