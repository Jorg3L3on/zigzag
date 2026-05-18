"use client"

import * as React from "react"
import { Label as LabelPrimitive, Slot as SlotPrimitive } from "radix-ui"

import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext?.name) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id, hasDescription, setHasDescription } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    hasDescription,
    setHasDescription,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
  hasDescription: boolean
  setHasDescription: (value: boolean) => void
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()
  const [hasDescription, setHasDescription] = React.useState(false)

  return (
    <FormItemContext.Provider value={{ id, hasDescription, setHasDescription }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof SlotPrimitive.Slot>,
  React.ComponentPropsWithoutRef<typeof SlotPrimitive.Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId, hasDescription } =
    useFormField()

  const describedBy = [
    hasDescription ? formDescriptionId : null,
    error ? formMessageId : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <SlotPrimitive.Slot
      ref={ref}
      id={formItemId}
      aria-describedby={describedBy || undefined}
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId, setHasDescription } = useFormField()

  React.useEffect(() => {
    setHasDescription(true)
    return () => setHasDescription(false)
  }, [setHasDescription])

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

function withValidationCode(message: React.ReactNode) {
  if (typeof message !== "string") {
    return message
  }

  if (message.includes("Código:")) {
    return message
  }

  return `${message} Código: GN003`
}

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : children
  const isFieldError = Boolean(error)

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      role={isFieldError ? "alert" : undefined}
      aria-live={isFieldError ? "polite" : undefined}
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {withValidationCode(body)}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
