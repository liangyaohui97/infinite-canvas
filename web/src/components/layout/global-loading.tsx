import { useEffect, useState } from "react";
import { useNavigation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function GlobalLoading({ label, overlay = false }: { label?: string; overlay?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className={overlay ? "fixed inset-0 z-[90] flex items-center justify-center bg-background/90 backdrop-blur-sm" : "flex h-full min-h-48 w-full items-center justify-center bg-background"} role="status" aria-live="polite" aria-label={label || t("common.loadingResources")}>
            <div className="flex flex-col items-center gap-4 text-foreground">
                <span className="text-4xl font-light leading-none motion-safe:animate-pulse" aria-hidden="true">
                    ∞
                </span>
                <span className="text-sm text-stone-600 dark:text-stone-300">{label || t("common.loadingResources")}</span>
                <span className="h-0.5 w-24 overflow-hidden bg-stone-200 dark:bg-stone-700" aria-hidden="true">
                    <span className="block h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] bg-stone-800 motion-reduce:animate-none dark:bg-stone-100" />
                </span>
            </div>
        </div>
    );
}

export function RouteLoadingOverlay() {
    const navigation = useNavigation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (navigation.state === "idle") {
            setVisible(false);
            return;
        }
        const timer = window.setTimeout(() => setVisible(true), 120);
        return () => window.clearTimeout(timer);
    }, [navigation.state]);

    return visible ? <GlobalLoading overlay /> : null;
}
