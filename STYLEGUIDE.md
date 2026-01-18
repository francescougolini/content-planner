# Style Guide (short)

UI building blocks and utility classes.

## Components

-   `Checkbox` — badge-style checkbox used for compact multi-select lists.
    Usage: <Checkbox checked onChange>Label</Checkbox>

-   `Button` — standardised button with `variant` ("primary"/"secondary"/"danger"), `size` ("normal"/"small"), and `full` props.
    Usage: <Button variant="primary" size="small">Save</Button>

-   `FormField` + `InputField` / `SelectField` / `TextareaField` — common form wrappers handling label, help, error messages.
    Usage: <InputField label="Username" value={x} onChange={...} error="Required" />

-   `Modal` — wraps a native `<dialog>` and forwards `showModal()` / `close()` via ref.
    Usage (imperative): const ref = useRef(); ref.current?.showModal();

-   `ConfirmModal` — small reusable confirm modal with a `show(message, onConfirm, title)` imperative API. Prefer **the global ConfirmProvider** instead of per-component modal instances.
    Usage (imperative via hook):

    1. Wrap app with `<ConfirmProvider>` in `App.jsx`.
    2. Use the `useConfirm()` hook inside components:

        ```jsx
        const confirm = useConfirm();
        confirm('Are you sure?', () => doAction(), 'Confirm');
        ```

-   `InputModal` — modal that collects a short text input via `show(message, defaultValue, onConfirm, title)`.
    Usage: inputRef.current.show('Enter value', '', v => handle(v))

-   `AlertModal` — small informational modal (replacement for blocking `alert()`), `show(message, title)`.
    Usage: alertRef.current.show('Saved successfully', 'Success')

-   `ToastProvider` / `useToast()` — non-blocking toast notifications for transient success/info/warning messages. Wrap your app with `<ToastProvider>` (already added in `App.jsx`) and call `const toast = useToast()` to show messages: `toast('Saved', 'success')`.

## Utility CSS classes

-   Spacing and layout helpers:

    -   `.mt-6`, `.mt-12`, `.mt-18` — margin-top helpers
    -   `.pt-12` — padding-top helper
    -   `.flex-between` — display:flex; justify-content:space-between; align-items:center
    -   `.flex-gap-8`, `.flex-gap-10` — horizontal flex with gap
    -   `.grid-gap-8`, `.grid-gap-12` — grid with gap

-   Form helpers:

    -   `.form-help-danger` — error helper text
    -   `.form-help` — muted helper text
    -   `.muted-small` — small muted text

-   Buttons
    -   `.btn.full` — full width primary button
