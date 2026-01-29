"use client";

import { useState } from "react";
import PharmacistList from "@/components/Pharmacist/PharmacistList";
import PharmacistProfile from "@/components/Pharmacist/PharmacistProfile";
import ChatInterface from "@/components/Pharmacist/ChatInterface";
import { AnimatePresence, motion } from "framer-motion";

type ViewState = "LIST" | "PROFILE" | "CHAT";

interface Pharmacist {
    id: string;
    full_name: string;
    specializations: string[];
    experience_years: number;
    languages: string[];
    rate: number;
    rating_avg: number;
    rating_count: number;
    is_available: boolean;
    profile_image_url?: string;
    duration_minutes?: number;
}

export default function BookPharmacistPage() {
    const [view, setView] = useState<ViewState>("LIST");
    const [selectedPharmacist, setSelectedPharmacist] = useState<Pharmacist | null>(null);
    const [consultationId, setConsultationId] = useState<string | null>(null);

    const handleSelectPharmacist = (pharmacist: Pharmacist) => {
        setSelectedPharmacist(pharmacist);
        setView("PROFILE");
    };

    const handleBookingComplete = (id: string) => {
        setConsultationId(id);
        setView("CHAT");
    };

    const handleBack = () => {
        if (view === "PROFILE") {
            setSelectedPharmacist(null);
            setView("LIST");
        } else if (view === "CHAT") {
            // Confirm before leaving chat? For now just go back to list
            setConsultationId(null);
            setSelectedPharmacist(null);
            setView("LIST");
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex gap-6 p-6 overflow-hidden bg-slate-50/50">
            {/* Left Panel: List (Always visible on large screens, or main view) */}
            <div className={`w-full lg:w-1/3 min-w-[320px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${view !== "LIST" ? "hidden lg:flex" : "flex"
                }`}>
                <PharmacistList onSelect={handleSelectPharmacist} />
            </div>

            {/* Right Panel: Content (Profile or Chat) */}
            <div className={`flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative transition-all duration-300 ${view === "LIST" ? "hidden lg:flex lg:items-center lg:justify-center" : "flex"
                }`}>
                <AnimatePresence mode="wait">
                    {view === "LIST" && (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center p-8 max-w-md"
                        >
                            <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl">👨‍⚕️</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Pharmacist</h3>
                            <p className="text-slate-500">
                                Browse the list on the left to view profiles, check availability, and book a consultation instantly.
                            </p>
                        </motion.div>
                    )}

                    {view === "PROFILE" && selectedPharmacist && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full h-full"
                        >
                            <PharmacistProfile
                                pharmacist={selectedPharmacist}
                                onBack={handleBack}
                                onBookingComplete={handleBookingComplete}
                            />
                        </motion.div>
                    )}

                    {view === "CHAT" && consultationId && selectedPharmacist && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full h-full"
                        >
                            <ChatInterface
                                consultationId={consultationId}
                                pharmacistName={selectedPharmacist.full_name}
                                endTime={new Date(Date.now() + (selectedPharmacist.duration_minutes || 15) * 60000).toISOString()}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
