"use client";

import React, { useState } from "react";
import { Save, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/api";
import { getErrorMessage } from "@/lib/api-error";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface CreateConcertFormProps {
  onCreated?: () => void;
}

export function CreateConcertForm({ onCreated }: CreateConcertFormProps) {
  const [name, setName] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !totalSeats.trim() || !description.trim()) return;

    setIsLoading(true);
    try {
      await api.createConcert({
        name: name.trim(),
        description: description.trim(),
        totalSeats: Number(totalSeats),
      });
      toast.success(t("admin.create_success"));
      setName("");
      setTotalSeats("");
      setDescription("");
      onCreated?.();
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.create_error")));
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = name.trim() && totalSeats.trim() && description.trim();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900">
          {t("admin.create_title")}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t("admin.create_subtitle")}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Row: Concert Name + Total seats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label
              htmlFor="concertName"
              className="text-sm font-medium text-gray-700"
            >
              {t("admin.concert_name")}
            </Label>
            <Input
              id="concertName"
              placeholder={t("admin.concert_name_placeholder")}
              className="h-10 rounded-xl border-gray-300 focus-visible:ring-brand/30 focus-visible:border-brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="totalSeats"
              className="text-sm font-medium text-gray-700"
            >
              {t("admin.total_of_seats")}
            </Label>
            <div className="relative">
              <Input
                id="totalSeats"
                type="number"
                placeholder="500"
                className="h-10 pr-10 rounded-xl border-gray-300 focus-visible:ring-brand/30 focus-visible:border-brand"
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                min={1}
                max={100000}
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Users className="size-4" />
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-sm font-medium text-gray-700"
          >
            {t("admin.description")}
          </Label>
          <Textarea
            id="description"
            placeholder={t("admin.description_placeholder")}
            className="min-h-[120px] resize-none rounded-xl border-gray-300 focus-visible:ring-brand/30 focus-visible:border-brand"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-3">
          <Button
            type="submit"
            disabled={isLoading || !isValid}
            className="gap-2 bg-brand hover:bg-brand-dark text-white px-6 h-10 rounded-xl shadow-md shadow-brand/25 transition-all duration-200 hover:shadow-lg hover:shadow-brand/35 disabled:opacity-40 disabled:shadow-none"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t("admin.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
