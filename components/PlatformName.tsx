"use client";

import { useState, useEffect } from "react";

function getPlatformNameFromStorage(): string {
  try {
    const data = JSON.parse(localStorage.getItem("detailbook_platform") || "{}");
    return data.platformName || "DetailBook";
  } catch {
    return "DetailBook";
  }
}

/** Renders the platform name dynamically. Use this instead of hardcoding "DetailBook". */
export default function PlatformName() {
  const [name, setName] = useState("DetailBook");
  useEffect(() => { setName(getPlatformNameFromStorage()); }, []);
  return <>{name}</>;
}

/** Hook to get the platform name. */
export function usePlatformName(): string {
  const [name, setName] = useState("DetailBook");
  useEffect(() => { setName(getPlatformNameFromStorage()); }, []);
  return name;
}
