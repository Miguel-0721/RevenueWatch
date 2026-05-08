"use client";

import { useEffect } from "react";

export default function DashboardViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.classList.add("rw-dashboard-viewport-lock");
    body.classList.add("rw-dashboard-viewport-lock");

    return () => {
      html.classList.remove("rw-dashboard-viewport-lock");
      body.classList.remove("rw-dashboard-viewport-lock");
    };
  }, []);

  return null;
}
