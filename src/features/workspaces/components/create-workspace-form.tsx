"use client";

import { z } from "zod";
import { useState, useRef } from "react";
import Image from "next/image";
import {
  ImageIcon,
  Loader2,
  Rocket,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  CheckCircle2,
  Layers,
  Award,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

import { createWorkspaceSchema } from "../schemas";
import { useCreateWorkspace } from "../api/use-create-workspace";

interface CreateWorkspaceFormProps {
  onCancel?: () => void;
}

export const CreateWorkspaceForm = ({ onCancel }: CreateWorkspaceFormProps) => {
  const router = useRouter();
  const { mutate, isPending } = useCreateWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 1: Archetype Selection, Step 2: Workspace Details
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<"STARTUP" | "COLLEGE">("STARTUP");

  const form = useForm<z.infer<typeof createWorkspaceSchema>>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      type: "STARTUP",
      batchName: "",
      academicYear: "",
    },
  });

  const handleSelectType = (type: "STARTUP" | "COLLEGE") => {
    setSelectedType(type);
    form.setValue("type", type);
  };

  const handleProceedToDetails = () => {
    form.setValue("type", selectedType);
    setStep(2);
  };

  const onSubmit = (values: z.infer<typeof createWorkspaceSchema>) => {
    const finalValues = {
      ...values,
      type: selectedType,
      image: values.image instanceof File ? values.image : "",
    };

    mutate(
      { form: finalValues },
      {
        onSuccess: ({ data }) => {
          form.reset();
          toast.success(`Workspace "${data.name}" created successfully!`);
          router.push(`/workspaces/${data.$id}`);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to create workspace");
        },
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("image", file);
    }
  };

  return (
    <Card className="w-full h-full border-none shadow-none">
      {/* ── STEP 1: UPFRONT WORKSPACE TYPE SELECTION ── */}
      {step === 1 && (
        <div className="animate-fade-in space-y-6">
          <CardHeader className="p-7 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[11px] font-mono uppercase tracking-wider">
                Step 1 of 2
              </Badge>
              <span className="text-xs text-muted-foreground">Select Archetype</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground mt-2">
              Choose Workspace Environment
            </CardTitle>
            <CardDescription className="text-sm">
              Select the operating mode that matches how your team works. We tailor your dashboards, permissions, and templates upfront.
            </CardDescription>
          </CardHeader>

          <div className="px-7">
            <DottedSeparator />
          </div>

          <CardContent className="p-7 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Tech Startup / Engineering */}
              <div
                onClick={() => handleSelectType("STARTUP")}
                className={cn(
                  "cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between relative group hover:shadow-md",
                  selectedType === "STARTUP"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card hover:bg-accent/30"
                )}
              >
                {selectedType === "STARTUP" && (
                  <div className="absolute top-4 right-4 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="size-3.5 stroke-[3]" />
                  </div>
                )}
                <div>
                  <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                    <Rocket className="size-6" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    Tech Startup / Engineering
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Agile sprints, Kanban issue boards, backlog grooming, and developer PR workflows.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground font-medium flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="size-3 text-indigo-500" /> Sprints & Kanban
                  </span>
                  <span>•</span>
                  <span>Granular RBAC</span>
                </div>
              </div>

              {/* Card B: College Academic Department */}
              <div
                onClick={() => handleSelectType("COLLEGE")}
                className={cn(
                  "cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between relative group hover:shadow-md",
                  selectedType === "COLLEGE"
                    ? "border-purple-600 bg-purple-500/5 ring-2 ring-purple-500/40 shadow-sm"
                    : "border-border hover:border-purple-500/40 bg-card hover:bg-accent/30"
                )}
              >
                {selectedType === "COLLEGE" && (
                  <div className="absolute top-4 right-4 size-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                    <Check className="size-3.5 stroke-[3]" />
                  </div>
                )}
                <div>
                  <div className="size-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                    <GraduationCap className="size-6" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    College Academic Department
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    HOD batch oversight, faculty guide allocations, student project teams, milestone reviews, and grading rubrics.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground font-medium flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Award className="size-3 text-purple-500" /> Guide Review Gate
                  </span>
                  <span>•</span>
                  <span>Viva Rubrics</span>
                </div>
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="pt-4 flex items-center justify-between gap-3">
              {onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="px-5 text-xs font-semibold"
                >
                  Cancel
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                onClick={handleProceedToDetails}
                className="px-6 gap-2 font-semibold text-xs h-10 ml-auto"
              >
                <span>Continue to Details</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </div>
      )}

      {/* ── STEP 2: WORKSPACE DETAILS BASED ON ARCHETYPE ── */}
      {step === 2 && (
        <div className="animate-fade-in space-y-4">
          <CardHeader className="p-7 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[11px] font-mono uppercase tracking-wider">
                Step 2 of 2
              </Badge>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="size-3" /> Change Archetype
              </button>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight text-foreground mt-2">
              {selectedType === "COLLEGE" ? "Department Setup" : "Startup Details"}
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedType === "COLLEGE"
                ? "Configure your department name and initial capstone batch cohort."
                : "Enter your startup workspace identity and branding."}
            </CardDescription>

            {/* Active Archetype Pill */}
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-muted/60 border text-xs">
              {selectedType === "COLLEGE" ? (
                <>
                  <GraduationCap className="size-4 text-purple-600 shrink-0" />
                  <span className="font-semibold text-foreground">Mode: College Academic Department</span>
                </>
              ) : (
                <>
                  <Rocket className="size-4 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-foreground">Mode: Tech Startup / Engineering</span>
                </>
              )}
            </div>
          </CardHeader>

          <div className="px-7">
            <DottedSeparator />
          </div>

          <CardContent className="p-7 pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Workspace Name Input */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {selectedType === "COLLEGE" ? "Department / College Name" : "Workspace Name"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={
                            selectedType === "COLLEGE"
                              ? "e.g. Department of Computer Engineering"
                              : "e.g. Acme Labs or NextGen Engine"
                          }
                          className="h-11 font-medium"
                          autoFocus
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription className="text-[11px]">
                        {selectedType === "COLLEGE"
                          ? "This name will be displayed to faculty members, student teams, and external evaluators."
                          : "Your primary organization or engineering team identifier."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* College-specific fields: Batch Name & Academic Year */}
                {selectedType === "COLLEGE" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <FormField
                      control={form.control}
                      name="batchName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            Academic Batch / Cohort
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g. BE 2026-27 or Capstone 2026"
                              className="h-10"
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px]">
                            Initial batch for student groups and guides.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="academicYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            Academic Year (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g. 2026-2027"
                              className="h-10"
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px]">
                            Used in rubric report exports.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Optional Image Upload */}
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <div className="flex flex-col gap-y-2 pt-2">
                      <FormLabel className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {selectedType === "COLLEGE" ? "Department Crest / Logo (Optional)" : "Workspace Logo (Optional)"}
                      </FormLabel>
                      <div className="flex items-center gap-x-4">
                        {field.value ? (
                          <div className="size-14 relative rounded-xl overflow-hidden border">
                            <Image
                              alt="Workspace Logo"
                              fill
                              className="object-cover"
                              src={
                                field.value instanceof File
                                  ? URL.createObjectURL(field.value)
                                  : field.value
                              }
                            />
                          </div>
                        ) : (
                          <Avatar className="size-14 rounded-xl border bg-muted flex items-center justify-center">
                            <AvatarFallback className="rounded-xl">
                              <Building className="size-6 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col gap-1">
                          <input
                            className="hidden"
                            type="file"
                            accept=".jpg, .png, .jpeg, .svg"
                            ref={inputRef}
                            onChange={handleImageChange}
                            disabled={isPending}
                          />
                          {field.value ? (
                            <Button
                              type="button"
                              disabled={isPending}
                              variant="destructive"
                              size="xs"
                              className="w-fit"
                              onClick={() => {
                                field.onChange(null);
                                if (inputRef.current) inputRef.current.value = "";
                              }}
                            >
                              Remove Image
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              disabled={isPending}
                              variant="outline"
                              size="xs"
                              className="w-fit font-medium"
                              onClick={() => inputRef.current?.click()}
                            >
                              <ImageIcon className="size-3.5 mr-1.5" />
                              Upload Image
                            </Button>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            PNG, JPG or SVG up to 2MB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                />

                <div className="pt-4 flex items-center justify-between gap-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isPending}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>

                  <Button
                    type="submit"
                    disabled={isPending || !form.watch("name")?.trim()}
                    className="gap-2 text-xs font-semibold px-6 h-10"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Workspace
                        <CheckCircle2 className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </div>
      )}
    </Card>
  );
};
