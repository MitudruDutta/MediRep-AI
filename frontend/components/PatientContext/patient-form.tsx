"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { PatientContext } from "@/types";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PatientFormProps {
  formData: PatientContext;
  setFormData: (data: PatientContext) => void;
}

export function PatientForm({ formData, setFormData }: PatientFormProps) {
  const [conditionInput, setConditionInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");



  const addItem = (
    value: string,
    field: "conditions" | "currentMeds" | "allergies",
    inputSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData({
        ...formData,
        [field]: [...formData[field], value.trim()],
      });
      inputSetter("");
    }
  };

  const removeItem = (
    index: number,
    field: "conditions" | "currentMeds" | "allergies"
  ) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">

      {/* Demographics */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="age">Age *</Label>
          <Input
            id="age"
            type="number"
            value={formData.age || ""}
            onChange={(e) =>
              setFormData({ ...formData, age: parseInt(e.target.value) || 0 })
            }
            placeholder="Enter age"
            min="0"
            max="150"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Required for age-appropriate dosing
          </p>
        </div>
        <div>
          <Label htmlFor="sex">Sex *</Label>
          <Select
            value={formData.sex}
            onValueChange={(value: any) => setFormData({ ...formData, sex: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input
            id="weight"
            type="number"
            value={formData.weight || ""}
            onChange={(e) =>
              setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })
            }
            placeholder="Optional"
            min="0"
            max="1000"
            step="0.1"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            For weight-based dosing
          </p>
        </div>
      </div>

      {/* Medical Conditions */}
      <div>
        <Label>Medical Conditions</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Add existing medical conditions (e.g., diabetes, hypertension)
        </p>
        <div className="flex gap-2">
          <Input
            value={conditionInput}
            onChange={(e) => setConditionInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(), addItem(conditionInput, "conditions", setConditionInput))
            }
            placeholder="Type condition and press Enter"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => addItem(conditionInput, "conditions", setConditionInput)}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <AnimatePresence mode="popLayout">
            {formData.conditions.map((condition, index) => (
              <motion.div
                key={condition}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Badge variant="secondary" className="gap-1 px-3 py-1">
                  {condition}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => removeItem(index, "conditions")}
                  />
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
          {formData.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No conditions added</p>
          )}
        </div>
      </div>

      {/* Current Medications */}
      <div>
        <Label>Current Medications</Label>
        <p className="text-xs text-muted-foreground mb-2">
          List all medications currently being taken
        </p>
        <div className="flex gap-2">
          <Input
            value={medInput}
            onChange={(e) => setMedInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(), addItem(medInput, "currentMeds", setMedInput))
            }
            placeholder="Type medication and press Enter"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => addItem(medInput, "currentMeds", setMedInput)}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <AnimatePresence mode="popLayout">
            {formData.currentMeds.map((med, index) => (
              <motion.div
                key={med}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Badge variant="default" className="gap-1 px-3 py-1">
                  {med}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive-foreground transition-colors"
                    onClick={() => removeItem(index, "currentMeds")}
                  />
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
          {formData.currentMeds.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No medications added</p>
          )}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <Label>Allergies</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Add known drug or substance allergies
        </p>
        <div className="flex gap-2">
          <Input
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(), addItem(allergyInput, "allergies", setAllergyInput))
            }
            placeholder="Type allergy and press Enter"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => addItem(allergyInput, "allergies", setAllergyInput)}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <AnimatePresence mode="popLayout">
            {formData.allergies.map((allergy, index) => (
              <motion.div
                key={allergy}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Badge variant="destructive" className="gap-1 px-3 py-1">
                  {allergy}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => removeItem(index, "allergies")}
                  />
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
          {formData.allergies.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No allergies added</p>
          )}
        </div>
      </div>
    </div>
  );
}
