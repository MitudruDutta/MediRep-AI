"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Check, X, Loader2, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminApi, PharmacistApplication } from "@/lib/admin-api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function VerificationPage() {
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<PharmacistApplication[]>([]);
    const [selectedApp, setSelectedApp] = useState<PharmacistApplication | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getPendingPharmacists();
            setApplications(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch pending applications");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleVerify = async (id: string, status: "approved" | "rejected", notes?: string) => {
        try {
            setProcessingId(id);
            await adminApi.verifyPharmacist(id, status, notes);
            toast.success(`Application ${status} successfully`);

            // Remove from list
            setApplications((prev) => prev.filter((app) => app.id !== id));

            if (status === "rejected") {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
            }
            setSelectedApp(null);
        } catch (error) {
            console.error(error);
            toast.error("Operation failed");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">License Verification</h2>
                    <p className="text-muted-foreground">
                        Review and verify pharmacist license applications.
                    </p>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                    {applications.length} Pending
                </Badge>
            </div>

            {applications.length === 0 ? (
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <ShieldCheck className="h-12 w-12 text-slate-700 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">All Caught Up</h3>
                        <p className="text-slate-500 max-w-sm mt-2">
                            No pending verification requests at the moment. Good job!
                        </p>
                        <Button onClick={fetchApplications} variant="outline" className="mt-6 border-slate-700 hover:bg-slate-800">
                            Refresh List
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* List View */}
                    <div className="space-y-4">
                        {applications.map((app) => (
                            <Card
                                key={app.id}
                                className={`cursor-pointer transition-colors border-slate-800 bg-slate-900 hover:bg-slate-800/50 ${selectedApp?.id === app.id ? "ring-2 ring-primary border-transparent" : ""}`}
                                onClick={() => setSelectedApp(app)}
                            >
                                <CardContent className="p-4 flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-400">
                                            {app.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{app.full_name}</h4>
                                            <div className="text-sm text-slate-400 flex items-center gap-2">
                                                <span>Lic: {app.license_number}</span>
                                                <span>•</span>
                                                <Badge variant={app.ai_confidence_score > 0.8 ? "default" : "destructive"} className="text-[10px] h-5">
                                                    AI: {Math.round(app.ai_confidence_score * 100)}%
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Applied: {new Date(app.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-slate-400">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Details View */}
                    <div className="lg:sticky lg:top-6 space-y-6">
                        {selectedApp ? (
                            <Card className="border-slate-800 bg-slate-900 overflow-hidden">
                                <CardHeader className="border-b border-slate-800 bg-slate-900/50">
                                    <CardTitle>Verification Details</CardTitle>
                                    <CardDescription>Compare extracted data with the uploaded image</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-1 gap-0">
                                        {/* Image Preview */}
                                        <div className="relative aspect-video w-full bg-black/50 flex items-center justify-center overflow-hidden group">
                                            <Image
                                                src={selectedApp.license_image_url || "/placeholder-license.jpg"}
                                                alt="License"
                                                fill
                                                className="object-contain"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button variant="secondary" onClick={() => window.open(selectedApp.license_image_url, '_blank')}>
                                                    Open Full Image
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Data Comparison */}
                                        <div className="p-6 space-y-6">
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Applicant Name</p>
                                                    <p className="font-medium text-slate-200">{selectedApp.full_name}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider">License Number</p>
                                                    <p className="font-medium text-slate-200">{selectedApp.license_number}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                                                    <p className="font-medium text-slate-200 break-all">{selectedApp.email || "N/A"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Phone</p>
                                                    <p className="font-medium text-slate-200">{selectedApp.phone}</p>
                                                </div>
                                            </div>

                                            {/* AI Extraction Results */}
                                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-800">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className={`h-2 w-2 rounded-full ${selectedApp.ai_confidence_score > 0.8 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <h4 className="text-sm font-semibold text-slate-300">AI Analysis</h4>
                                                    <span className="text-xs text-slate-500 ml-auto">Confidence: {Math.round(selectedApp.ai_confidence_score * 100)}%</span>
                                                </div>

                                                {selectedApp.ai_extracted_data ? (
                                                    <div className="space-y-2 text-xs text-slate-400">
                                                        <div className="flex justify-between">
                                                            <span>Extracted Name:</span>
                                                            <span className={selectedApp.ai_extracted_data.name_match ? "text-green-400" : "text-amber-400"}>
                                                                {selectedApp.ai_extracted_data.full_name || "Not found"}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Extracted License:</span>
                                                            <span className={selectedApp.ai_extracted_data.license_match ? "text-green-400" : "text-amber-400"}>
                                                                {selectedApp.ai_extracted_data.license_number || "Not found"}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Expiry Date:</span>
                                                            <span>{selectedApp.ai_extracted_data.expiry_date || "Not visible"}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500 italic">No AI data available.</p>
                                                )}

                                                {selectedApp.ai_confidence_score < 0.8 && (
                                                    <div className="mt-3 flex items-start gap-2 text-amber-400 text-xs bg-amber-950/30 p-2 rounded">
                                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                        <p>Low confidence match. Please verify the image manually with extra care.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-3 pt-2">
                                                <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="destructive" className="flex-1" disabled={!!processingId}>
                                                            <X className="mr-2 h-4 w-4" /> Reject
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                        <DialogHeader>
                                                            <DialogTitle>Reject Application</DialogTitle>
                                                            <DialogDescription>
                                                                Please provide a reason for rejection. This will be sent to the applicant.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <Textarea
                                                            placeholder="Reason for rejection (e.g. Image blurry, License expired)..."
                                                            value={rejectionReason}
                                                            onChange={(e) => setRejectionReason(e.target.value)}
                                                            className="bg-slate-950 border-slate-800 min-h-[100px]"
                                                        />
                                                        <DialogFooter>
                                                            <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => handleVerify(selectedApp.id, "rejected", rejectionReason)}
                                                                disabled={!rejectionReason.trim() || processingId === selectedApp.id}
                                                            >
                                                                {processingId === selectedApp.id ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirm Rejection"}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>

                                                <Button
                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleVerify(selectedApp.id, "approved")}
                                                    disabled={!!processingId}
                                                >
                                                    {processingId === selectedApp.id ? <Loader2 className="animate-spin h-4 w-4" /> : (
                                                        <>
                                                            <Check className="mr-2 h-4 w-4" /> Approve
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="h-64 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-600">
                                <p>Select an application to verify</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ShieldCheck({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
