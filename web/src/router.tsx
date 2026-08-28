import type { ComponentType } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import { GlobalLoading } from "@/components/layout/global-loading";
import UserLayout from "@/layouts/user-layout";

const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default });

export const router = createBrowserRouter([
    {
        HydrateFallback: GlobalLoading,
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", lazy: lazyPage(() => import("@/pages/home")) },
            { path: "/image", lazy: lazyPage(() => import("@/pages/image")) },
            { path: "/video", lazy: lazyPage(() => import("@/pages/video")) },
            { path: "/assets", lazy: lazyPage(() => import("@/pages/assets")) },
            { path: "/prompts", lazy: lazyPage(() => import("@/pages/prompts")) },
            { path: "/canvas", lazy: lazyPage(() => import("@/pages/canvas")) },
            { path: "/canvas/:id", lazy: lazyPage(() => import("@/pages/canvas/project")) },
            { path: "/config", lazy: lazyPage(() => import("@/pages/config")) },
        ],
    },
    { path: "*", lazy: lazyPage(() => import("@/pages/not-found")) },
]);
