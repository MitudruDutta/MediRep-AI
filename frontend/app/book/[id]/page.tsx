"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, ArrowLeft, ShieldCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { marketplaceApi, PharmacistPreview, ScheduleSlot } from "@/lib/marketplace-api";
import { format, addDays, startOfToday, isSameDay, parse, set } from "date-fns";

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function BookingPage() {
    const params = useParams();
    const router = useRouter();
    const pharmacistId = params.id as string;

    const [pharmacist, setPharmacist] = useState<PharmacistPreview | null>(null);
    const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);

    // Selection State
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [concern, setConcern] = useState("");

    useEffect(() => {
        async function loadData() {
            try {
                const [pharma, _schedule] = await Promise.all([
                    marketplaceApi.getPharmacist(pharmacistId),
                    marketplaceApi.getSchedule(pharmacistId)
                ]);
                setPharmacist(pharma);
                setSchedule(_schedule);
            } catch (error) {
                toast.error("Failed to load pharmacist details");
                router.push("/marketplace");
            } finally {
                setLoading(false);
            }
        }
        if (pharmacistId) loadData();
    }, [pharmacistId, router]);

    // Generate selectable days (next 7 days)
    const availableDays = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i));

    // Get slots for selected date
    const getSlotsForDate = (date: Date) => {
        const dayOfWeek = date.getDay(); // 0-6
        return schedule.filter(s => s.day_of_week === dayOfWeek && s.is_active);
    };

    const handleBook = async () => {
        if (!selectedSlot || !pharmacist) return;

        try {
            setBooking(true);

            // Construct scheduled_at ISO string
            // Combine selectedDate (YYYY-MM-DD) and selectedSlot (HH:MM)
            const [hours, minutes] = selectedSlot.split(':').map(Number);
            const scheduledAt = set(selectedDate, { hours, minutes }).toISOString();

            const data = await marketplaceApi.bookConsultation(pharmacistId, scheduledAt, concern);

            // Initialize Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: data.amount * 100,
                currency: data.currency,
                name: "MediRep AI",
                description: `Consultation with ${data.pharmacist_name}`,
                order_id: data.razorpay_order_id,
                handler: function (response: any) {
                    toast.success("Booking Confirmed!");
                    router.push(`/consultations/${data.consultation_id}`);
                },
                prefill: {
                    name: "Patient", // Ideally fetch from user profile
                    email: "patient@example.com",
                    contact: "9999999999"
                },
                theme: {
                    color: "#6366f1"
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Booking failed");
        } finally {
            setBooking(false); // Only set false if error, otherwise we redirect
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    if (!pharmacist) return null;

    const activeSlots = getSlotsForDate(selectedDate);

    return (
        <div className="min-h-screen bg-slate-950 p-6 flex justify-center items-start">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left: Pharmacist Info */}
                <div className="md:col-span-1 space-y-6">
                    <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:bg-transparent text-slate-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
                    </Button>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <Avatar className="h-24 w-24 border-4 border-slate-800">
                                <AvatarImage src={pharmacist.profile_image_url} />
                                <AvatarFallback>{pharmacist.full_name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-bold text-slate-200">{pharmacist.full_name}</h2>
                                <p className="text-sm text-indigo-400 font-medium">{pharmacist.specializations?.join(", ")}</p>
                            </div>
                            <div className="text-sm text-slate-400 w-full pt-4 border-t border-slate-800 text-left">
                                <p className="line-clamp-4">{pharmacist.bio}</p>
                            </div>
                            <div className="w-full bg-slate-950 p-3 rounded-lg flex justify-between items-center text-sm">
                                <span className="text-slate-500">Rate</span>
                                <span className="font-bold text-slate-200">₹{pharmacist.rate} <span className="text-xs font-normal">/ session</span></span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Booking Form */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle>Select Appointment Time</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Date Selector */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {availableDays.map((date) => {
                                    const isSelected = isSameDay(date, selectedDate);
                                    return (
                                        <div
                                            key={date.toISOString()}
                                            onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                                            className={`
                              flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-lg cursor-pointer border transition-all
                              ${isSelected
                                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50"
                                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"}
                            `}
                                        >
                                            <span className="text-xs font-medium uppercase">{format(date, "EEE")}</span>
                                            <span className="text-xl font-bold">{format(date, "d")}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Slot Selector */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Available Slots
                                </h3>

                                {activeSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {activeSlots.map((slot) => {
                                            // Naive slots: just show start time
                                            // In reality, we'd split start-end into 15/30 min chunks or just use start time as the slot
                                            // Assuming start_time is the slot start.

                                            const isSelected = selectedSlot === slot.start_time;
                                            return (
                                                <button
                                                    key={`${slot.day_of_week}-${slot.start_time}`}
                                                    onClick={() => setSelectedSlot(slot.start_time)}
                                                    className={`
                                   py-2 px-3 text-sm rounded border transition-colors
                                   ${isSelected
                                                            ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                                                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"}
                                 `}
                                                >
                                                    {slot.start_time.slice(0, 5)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
                                        No slots available specifically for this day.
                                    </div>
                                )}
                            </div>

                            {/* Concern Input */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-slate-400">What is your concern?</h3>
                                <Textarea
                                    value={concern}
                                    onChange={(e) => setConcern(e.target.value)}
                                    placeholder="Briefly describe your symptoms or questions..."
                                    className="bg-slate-950 border-slate-800 min-h-[100px]"
                                />
                            </div>
                        </CardContent>

                        <CardFooter className="pt-2">
                            <Button
                                onClick={handleBook}
                                disabled={!selectedSlot || !concern || booking}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-12 text-lg shadow-lg shadow-indigo-900/20"
                            >
                                {booking ? (
                                    "Processing Payment..."
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Prepare to Pay ₹{pharmacist.rate} <CreditCard className="h-4 w-4" />
                                    </span>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    <p className="text-xs text-center text-slate-500">
                        <ShieldCheck className="inline h-3 w-3 mr-1" />
                        Payment is held securely and only released to the pharmacist after the consultation.
                    </p>
                </div>
            </div>
        </div>
    );
}
