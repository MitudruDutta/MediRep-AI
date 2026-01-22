"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Check } from "lucide-react";
import { usePatientContext } from "@/lib/context/PatientContext";
import { PatientContext } from "@/types";

export default function PatientContextWidget() {
  const { patientContext, setPatientContext, isActive } = usePatientContext();
  
  const [age, setAge] = useState(patientContext?.age || 0);
  const [sex, setSex] = useState<"male" | "female" | "other">(patientContext?.sex || "male");
  const [conditions, setConditions] = useState<string[]>(patientContext?.conditions || []);
  const [currentMeds, setCurrentMeds] = useState<string[]>(patientContext?.currentMeds || []);
  const [allergies, setAllergies] = useState<string[]>(patientContext?.allergies || []);
  
  const [conditionInput, setConditionInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");

  const addItem = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>, inputSetter: React.Dispatch<React.SetStateAction<string>>) => {
    if (value.trim()) {
      setter(prev => [...prev, value.trim()]);
      inputSetter("");
    }
  };

  const removeItem = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    const context: PatientContext = {
      age,
      sex,
      conditions,
      currentMeds,
      allergies,
    };
    setPatientContext(context);
  };

  const handleClear = () => {
    setAge(0);
    setSex("male");
    setConditions([]);
    setCurrentMeds([]);
    setAllergies([]);
    setPatientContext(null);
  };

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Patient Context</h2>
        {isActive && (
          <Badge variant="default" className="bg-success">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={age || ""}
              onChange={(e) => setAge(parseInt(e.target.value) || 0)}
              placeholder="Enter age"
              min="0"
              max="150"
            />
          </div>
          <div>
            <Label htmlFor="sex">Sex</Label>
            <Select value={sex} onValueChange={(value: any) => setSex(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Medical Conditions</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={conditionInput}
              onChange={(e) => setConditionInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem(conditionInput, setConditions, setConditionInput)}
              placeholder="Add condition"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => addItem(conditionInput, setConditions, setConditionInput)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {conditions.map((condition, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {condition}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeItem(index, setConditions)}
                />
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Current Medications</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={medInput}
              onChange={(e) => setMedInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem(medInput, setCurrentMeds, setMedInput)}
              placeholder="Add medication"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => addItem(medInput, setCurrentMeds, setMedInput)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {currentMeds.map((med, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {med}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeItem(index, setCurrentMeds)}
                />
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Allergies</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem(allergyInput, setAllergies, setAllergyInput)}
              placeholder="Add allergy"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => addItem(allergyInput, setAllergies, setAllergyInput)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {allergies.map((allergy, index) => (
              <Badge key={index} variant="destructive" className="gap-1">
                {allergy}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeItem(index, setAllergies)}
                />
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Context
          </Button>
          <Button onClick={handleClear} variant="outline">
            Clear
          </Button>
        </div>
      </div>
    </Card>
  );
}
