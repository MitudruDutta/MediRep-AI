"use client";

import { useState } from "react";
import { Search, ExternalLink, Star, TrendingDown, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-white mb-3 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        Medicine Price Compare
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Compare prices across 13+ Indian pharmacies instantly
                    </p>
                </div>

                {/* Search Bar */}
                <div className="flex gap-3 max-w-2xl mx-auto mb-10">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                        <Input
                            type="text"
                            placeholder="Enter medicine name (e.g., Paracetamol, Crocin)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="pl-12 h-14 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading}
                        className="h-14 px-8 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/25"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Compare"
                        )}
                    </Button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="flex items-center justify-center gap-2 text-red-400 mb-6">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
                        <p className="text-slate-400">Searching across {data?.providers_searched || 13} pharmacies...</p>
                    </div>
                )}

                {/* Results */}
                {data && !loading && (
                    <div className="space-y-6">
                        {/* Stats Bar */}
                        <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm">
                            <span>Found <strong className="text-white">{data.total_results}</strong> results</span>
                            <span>•</span>
                            <span>Searched <strong className="text-white">{data.providers_searched}</strong> pharmacies</span>
                            <span>•</span>
                            <span>Completed in <strong className="text-white">{data.duration_seconds.toFixed(1)}s</strong></span>
                        </div>

                        {/* Results Grid */}
                        {data.results.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {data.results.map((result, index) => {
                                    const price = parsePrice(result.price);
                                    const isLowest = price === lowestPrice;

                                    return (
                                        <Card
                                            key={index}
                                            className={`bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all duration-300 backdrop-blur-sm ${isLowest ? "ring-2 ring-green-500/50 border-green-500/30" : ""
                                                }`}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <CardTitle className="text-white text-lg font-medium line-clamp-2">
                                                        {result.name}
                                                    </CardTitle>
                                                    {isLowest && (
                                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1 shrink-0 ml-2">
                                                            <TrendingDown className="h-3 w-3" />
                                                            Best
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="w-fit text-purple-300 border-purple-500/30">
                                                    {result.source}
                                                </Badge>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-3xl font-bold text-white">
                                                        {result.price}
                                                    </span>
                                                    {result.rating && (
                                                        <div className="flex items-center gap-1 text-yellow-400">
                                                            <Star className="h-4 w-4 fill-current" />
                                                            <span className="text-sm">{result.rating}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {result.url && (
                                                    <a
                                                        href={result.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-colors duration-200"
                                                    >
                                                        View on {result.source}
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-slate-400 text-lg">No results found for "{data.query}"</p>
                                <p className="text-slate-500 mt-2">Try a different medicine name</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Initial State */}
                {!data && !loading && !error && (
                    <div className="text-center py-16">
                        <Search className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">Enter a medicine name to compare prices</p>
                        <p className="text-slate-500 mt-2">We'll search across 13+ pharmacies to find you the best deal</p>
                    </div>
                )}
            </div>
        </div>
    );
}
