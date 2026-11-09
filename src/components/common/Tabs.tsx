"use client";

import { Tabs as RadixTabs } from "radix-ui";
import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn";

// Radix Tabs 기반 탭, 방향키·Home/End 이동과 자동 활성화는 Radix 기본 동작
export const Tabs = RadixTabs.Root;

export const TabsList = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixTabs.List>) => (
  <RadixTabs.List className={cn("flex border-b border-gray-200", className)} {...props} />
);

export const TabsTrigger = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) => (
  <RadixTabs.Trigger
    className={cn(
      "-mb-px h-10 border-b-2 border-transparent px-4 text-sm font-medium text-gray-500 hover:text-gray-900",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
      "data-[state=active]:border-blue-600 data-[state=active]:text-blue-600",
      className,
    )}
    {...props}
  />
);

export const TabsContent = RadixTabs.Content;
