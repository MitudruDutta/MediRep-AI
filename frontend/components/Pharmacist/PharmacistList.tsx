"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Star, Clock, Filter, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface PharmacistListProps {
    onSelect: (pharmacist: Pharmacist) => void;
}

export default function PharmacistList({ onSelect }: PharmacistListProps) {
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [selectedSpec, setSelectedSpec] = useState<string | null>(null);

    useEffect(() => {
        fetchPharmacists();
    }, []);

    const fetchPharmacists = async () => {
        try {
            // Fetch all approved pharmacists
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/marketplace/pharmacists?available_only=false`);
            if (res.ok) {
                const data = await res.json();
                setPharmacists(data);
            }
        } catch (error) {
            console.error("Failed to fetch pharmacists", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPharmacists = pharmacists.filter(p => {
        const matchQuery = p.full_name.toLowerCase().includes(query.toLowerCase()) ||
            p.specializations.some(s => s.toLowerCase().includes(query.toLowerCase()));
        const matchSpec = selectedSpec ? p.specializations.includes(selectedSpec) : true;
        return matchQuery && matchSpec;
    });

    const specializations = Array.from(new Set(pharmacists.flatMap(p => p.specializations)));

    return (
        <div className="h-full flex flex-col">
            {/* Header / Search */}
            <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Find a Pharmacist</h2>
                    <p className="text-slate-500">Connect with verified experts for medicine consultations</p>
                </div>

                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name or specialization..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-9 bg-white border-slate-200 focus-visible:ring-cyan-500"
                        />
                    </div>
                </div>

                {/* Filter Tags */}
                {specializations.length > 0 && (
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setSelectedSpec(null)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!selectedSpec
                                    ? "bg-cyan-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            All
                        </button>
                        {specializations.map(spec => (
                            <button
                                key={spec}
                                onClick={() => setSelectedSpec(spec === selectedSpec ? null : spec)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${spec === selectedSpec
                                        ? "bg-cyan-600 text-white"
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                {spec}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading experts...</p>
                    </div>
                ) : filteredPharmacists.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <p>No pharmacists found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredPharmacists.map((pharmacist) => (
                            <motion.div
                                key={pharmacist.id}
                                layoutId={pharmacist.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => onSelect(pharmacist)}
                            >
                                <Card className="cursor-pointer hover:shadow-lg hover:border-cyan-200 transition-all group">
                                    <CardContent className="p-4 flex gap-4">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm">
                                                {pharmacist.profile_image_url ? (
                                                    <img
                                                        src={pharmacist.profile_image_url}
                                                        alt={pharmacist.full_name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-cyan-50 text-cyan-600">
                                                        <User className="h-8 w-8" />
                                                    </div>
                                                )}
                                            </div>
                                            {pharmacist.is_available && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Online" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
                                                        {pharmacist.full_name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 line-clamp-1">
                                                        {pharmacist.specializations.join(", ")}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-amber-700 text-xs font-bold">
                                                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                                    {pharmacist.rating_avg.toFixed(1)}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {pharmacist.experience_years}y exp
                                                </div>
                                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    {pharmacist.languages[0]}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="flex flex-col justify-center items-end pl-4 border-l border-slate-100">
                                            <span className="text-lg font-bold text-slate-900">₹{pharmacist.rate}</span>
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">per session</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
