"use client";

import { useState } from "react";
import { Search, ExternalLink, Star, TrendingDown, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface PriceResult {
    name: string;
    price: string;
    source: string;
    url: string;
    rating?: number | null;
}

interface CompareResponse {
    query: string;
    total_results: number;
    best_deal: PriceResult | null;
    results: PriceResult[];
    duration_seconds: number;
    providers_searched: number;
}

export default function PriceCompare() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CompareResponse | null>(null);

    const handleSearch = async () => {
        if (!query.trim() || query.length < 2) {
            setError("Please enter at least 2 characters");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/prices/compare?drug_name=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch prices");
            }

            const result: CompareResponse = await response.json();
            setData(result);
        } catch (err) {
            setError("Failed to fetch prices. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const parsePrice = (price: string): number => {
        const match = price.match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, "")) : Infinity;
    };

    const getLowestPrice = (): number => {
        if (!data?.results.length) return Infinity;
        return Math.min(...data.results.map((r) => parsePrice(r.price)));
    };

    const lowestPrice = getLowestPrice();

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-10 space-y-4">
                        <div className="inline-flex items-center justify-center p-3 bg-cyan-100 rounded-2xl mb-2">
                            <Search className="h-6 w-6 text-cyan-600" />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
                            Check Medicine Prices
                        </h1>
                        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            Compare instant prices across 13+ top pharmacies.
                            <br className="hidden md:block" />
                            Find the best deals for your prescription.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-2xl mx-auto mb-16 shadow-xl shadow-cyan-900/5 rounded-2xl">
                        <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 transition-all duration-300 overflow-hidden">
                            <div className="pl-6 text-slate-400">
                                <Search className="h-5 w-5" />
                            </div>
                            <Input
                                type="text"
                                placeholder="Search medicine (e.g., Dolo 650, Augmentin)"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="h-16 border-0 text-lg bg-transparent placeholder:text-slate-400 focus-visible:ring-0 px-4"
                            />
                            <div className="pr-2">
                                <Button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="h-12 px-8 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl transition-all hover:scale-105"
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        "Compare"
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute -bottom-12 left-0 right-0 flex items-center justify-center gap-2 text-red-500 text-sm font-medium"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4">
                                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                            </div>
                            <p className="text-slate-600 font-medium">Scanning network...</p>
                            <p className="text-sm text-slate-400 mt-1">Checking {data?.providers_searched || 13} pharmacies</p>
                        </div>
                    )}

                    {/* Results Area */}
                    {data && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {/* Stats */}
                            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500 bg-white py-3 px-6 rounded-full shadow-sm w-fit mx-auto border border-slate-100">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    Found Results: <strong className="text-slate-900">{data.total_results}</strong>
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Time: <strong className="text-slate-900">{data.duration_seconds.toFixed(2)}s</strong>
                                </span>
                            </div>

                            {/* Cards Grid */}
                            {data.results.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {data.results.map((result, index) => {
                                        const price = parsePrice(result.price);
                                        const isLowest = price === lowestPrice;

                                        return (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <Card className={`h-full hover:shadow-lg transition-all duration-300 border-slate-200 overflow-hidden ${isLowest ? "ring-2 ring-emerald-500 ring-offset-2" : "hover:border-cyan-200"}`}>
                                                    <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 font-normal">
                                                                {result.source}
                                                            </Badge>
                                                            {isLowest && (
                                                                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm border-0 gap-1">
                                                                    <TrendingDown className="h-3 w-3" />
                                                                    Best Price
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <CardTitle className="text-base font-semibold leading-tight text-slate-900 mt-2 line-clamp-2 min-h-[2.5rem]" title={result.name}>
                                                            {result.name}
                                                        </CardTitle>
                                                    </CardHeader>

                                                    <CardContent className="pt-4 space-y-4">
                                                        <div className="flex items-end justify-between">
                                                            <div>
                                                                <p className="text-sm text-slate-400 font-medium mb-1">Price</p>
                                                                <p className="text-2xl font-bold text-slate-900 tracking-tight">{result.price}</p>
                                                            </div>
                                                            {result.rating && (
                                                                <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-1 rounded-md mb-1">
                                                                    <Star className="h-3.5 w-3.5 fill-current" />
                                                                    <span className="text-xs font-bold">{result.rating}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {result.url && (
                                                            <a
                                                                href={result.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`flex items-center justify-center w-full py-2.5 rounded-lg text-sm font-medium transition-all ${isLowest
                                                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-lg"
                                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                                                                    }`}
                                                            >
                                                                Visit Pharmacy
                                                                <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <Search className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-900 font-medium">No results found</p>
                                    <p className="text-slate-500 text-sm mt-1">Try searching for a generic name instead</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
