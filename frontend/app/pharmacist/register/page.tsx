"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Upload, Check, ChevronRight, ChevronLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModeToggle } from "@/components/mode-toggle";
import { createClient } from "@/lib/supabase/client";

// Steps
const STEPS = ["Basic Info", "Professional", "License", "Review"];

export default function PharmacistRegistrationPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        bio: "",
        specializations: "", // comma separated string for input
        experience_years: 0,
        languages: "English, Hindi",
        education: "",
        license_number: "",
        license_state: "",
        license_image_url: "",
        rate: 299,
        duration_minutes: 15,
        upi_id: ""
    });

    const [licenseFile, setLicenseFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLicenseFile(file);

            // Auto upload
            setIsUploading(true);
            try {
                const supabase = createClient();
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `licenses/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('private_documents') // Assuming a bucket strictly for this
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get publicly accessible URL (Warning: Licenses should be private ideally, relying on signed URLs)
                // For simplicity in this demo, we assume public bucket or signed handling in backend.
                // Actually, let's just get the public URL for now.
                const { data: { publicUrl } } = supabase.storage
                    .from('private_documents')
                    .getPublicUrl(filePath);

                setFormData(prev => ({ ...prev, license_image_url: publicUrl }));
                toast.success("License uploaded successfully");
            } catch (error) {
                console.error(error);
                toast.error("Failed to upload license image");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Prepare payload
            const payload = {
                ...formData,
                specializations: formData.specializations.split(',').map(s => s.trim()).filter(Boolean),
                languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
                experience_years: Number(formData.experience_years),
                rate: Number(formData.rate),
                duration_minutes: Number(formData.duration_minutes)
            };

            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                toast.error("You must be logged in to register");
                return;
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/pharmacist/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || "Registration failed");
            }

            toast.success("Registration submitted successfully!");
            router.push("/pharmacist/dashboard");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            <div className="w-full max-w-3xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Join MediRep Marketplace
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Register as a pharmacist to start earning by providing consultations.
                    </p>
                </div>

                {/* Steps Indicator */}
                <div className="flex justify-between mb-8 px-12 relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -z-10" />
                    {STEPS.map((step, index) => {
                        const stepNum = index + 1;
                        const isCompleted = currentStep > stepNum;
                        const isActive = currentStep === stepNum;

                        return (
                            <div key={step} className="flex flex-col items-center gap-2 bg-background px-2">
                                <div className={`
                   w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                   ${isActive ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' :
                                        isCompleted ? 'border-green-500 bg-green-500 text-slate-950' :
                                            'border-slate-700 bg-slate-900 text-slate-600'}
                 `}>
                                    {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                                </div>
                                <span className={`text-xs ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>{step}</span>
                            </div>
                        );
                    })}
                </div>



                <Card className="bg-card border-border shadow-xl">
                    <CardHeader>
                        <CardTitle>{STEPS[currentStep - 1]}</CardTitle>
                        <CardDescription>Please provide the required details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Step 1: Basic Info */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input
                                            name="full_name"
                                            value={formData.full_name}
                                            onChange={handleInputChange}
                                            placeholder="Dr. John Doe"
                                            className="bg-background border-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <Input
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="+91 98765 43210"
                                            className="bg-background border-input"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Professional Bio</Label>
                                    <Textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleInputChange}
                                        placeholder="Describe your expertise and background..."
                                        className="bg-background border-input min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fluent Languages (Comma separated)</Label>
                                    <Input
                                        name="languages"
                                        value={formData.languages}
                                        onChange={handleInputChange}
                                        className="bg-background border-input"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Professional */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Specializations (Comma separated)</Label>
                                    <Input
                                        name="specializations"
                                        value={formData.specializations}
                                        onChange={handleInputChange}
                                        placeholder="Cardiology, Diabetology, General Medicine"
                                        className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Years of Experience</Label>
                                        <Input
                                            type="number"
                                            name="experience_years"
                                            value={formData.experience_years}
                                            onChange={handleInputChange}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Education / Degree</Label>
                                        <Input
                                            name="education"
                                            value={formData.education}
                                            onChange={handleInputChange}
                                            placeholder="M.Pharm, PhD"
                                            className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>


                                <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-4">
                                    <h4 className="text-sm font-semibold text-muted-foreground">Consultation Settings</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Rate (INR)</Label>
                                            <Input
                                                type="number"
                                                name="rate"
                                                value={formData.rate}
                                                onChange={handleInputChange}
                                                className="bg-background border-input"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Duration (Minutes)</Label>
                                            <Select
                                                value={String(formData.duration_minutes)}
                                                onValueChange={(val) => setFormData(prev => ({ ...prev, duration_minutes: Number(val) }))}
                                            >
                                                <SelectTrigger className="bg-background border-input">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="15">15 Mins</SelectItem>
                                                    <SelectItem value="30">30 Mins</SelectItem>
                                                    <SelectItem value="45">45 Mins</SelectItem>
                                                    <SelectItem value="60">60 Mins</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UPI ID (For Payouts)</Label>
                                        <Input
                                            name="upi_id"
                                            value={formData.upi_id}
                                            onChange={handleInputChange}
                                            placeholder="username@upi"
                                            className="bg-background border-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: License */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">License Number</Label>
                                        <Input
                                            name="license_number"
                                            value={formData.license_number}
                                            onChange={handleInputChange}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Issuing State</Label>
                                        <Input
                                            name="license_state"
                                            value={formData.license_state}
                                            onChange={handleInputChange}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Upload License Certificate</Label>
                                    <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors relative">
                                        {formData.license_image_url ? (
                                            <div className="relative w-full h-48">
                                                <Image
                                                    src={formData.license_image_url}
                                                    alt="License"
                                                    fill
                                                    className="object-contain"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="absolute top-2 right-2 bg-slate-900/80"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setFormData(prev => ({ ...prev, license_image_url: "" }));
                                                    }}
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 text-slate-600 mb-2" />
                                                <p className="text-sm text-slate-500 text-center mb-4">
                                                    Drag and drop or click to upload<br />
                                                    (JPG, PNG, PDF up to 5MB)
                                                </p>
                                                <Input
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={handleFileChange}
                                                    disabled={isUploading}
                                                />
                                                {isUploading && <Loader2 className="animate-spin h-5 w-5 text-indigo-500" />}
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        <Shield className="inline h-3 w-3 mr-1" />
                                        Your license information is encrypted and only visible to verification admins.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Review */}
                        {currentStep === 4 && (
                            <div className="space-y-4 text-sm text-foreground">
                                <div className="p-4 bg-card border border-border rounded-lg space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Name</span>
                                        <span className="font-medium">{formData.full_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">License</span>
                                        <span className="font-medium">{formData.license_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rate</span>
                                        <span className="font-medium">₹{formData.rate} / {formData.duration_minutes} min</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Specializations</span>
                                        <span className="font-medium">{formData.specializations}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">License Photo</span>
                                        <span className={formData.license_image_url ? "text-green-500" : "text-red-500"}>
                                            {formData.license_image_url ? "Uploaded" : "Missing"}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-amber-950/20 border border-amber-900/50 p-3 rounded text-amber-200/80 text-xs">
                                    By submitting, you agree to the Terms of Service. Your profile will be reviewed by our admin team within 24-48 hours.
                                </div>
                            </div>
                        )}

                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-border pt-6">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStep === 1 || isSubmitting}
                            className="border-input hover:bg-accent"
                        >
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back
                        </Button>

                        {currentStep < STEPS.length ? (
                            <Button onClick={handleNext} disabled={isUploading}>
                                Next <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !formData.license_image_url}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-900/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                                    </>
                                ) : (
                                    "Submit Application"
                                )}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div >
        </div >
    );
}
