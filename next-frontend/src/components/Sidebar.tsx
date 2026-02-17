"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
    LineChart,
    BarChart3,
    Wallet,
    ArrowLeftRight,
    LogOut,
    LayoutDashboard
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useEffect, useState } from "react";

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Hide sidebar on login page
    if (!isClient || pathname === "/") return null;

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const navItems = [
        { name: "Binance Trader", href: "/dashboard", icon: LayoutDashboard },
        { name: "Kalshi", href: "/kalshi", icon: BarChart3 },
        { name: "Polymarkets", href: "/polymarkets", icon: LineChart },
        { name: "Robinhood", href: "/robinhood", icon: Wallet },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>
                    <span className="logo-icon">₿</span>
                    Binance Trader
                </h1>
                <p>Trading Dashboard</p>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-nav-item ${isActive(item.href) ? "active" : ""}`}
                        >
                            <Icon />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-plan">
                    <div className="sidebar-plan-label">Current Plan</div>
                    <div className="sidebar-plan-value">Pro Trader</div>
                </div>

                <button
                    onClick={handleLogout}
                    className="sidebar-logout"
                >
                    <LogOut />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
