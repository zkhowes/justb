"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocationInput } from "@/components/location-input";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("justb-city");
    if (saved) {
      router.replace("/feed");
    }
  }, [router]);

  function handleSelect(city: string) {
    localStorage.setItem("justb-city", city);
    router.push("/feed");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="font-serif text-5xl font-bold tracking-tight mb-3">
          JustB
        </h1>
        <p className="text-[var(--text-secondary)] text-lg">
          just be here. just be now.
        </p>
      </div>
      <LocationInput onSelect={handleSelect} />
    </main>
  );
}
