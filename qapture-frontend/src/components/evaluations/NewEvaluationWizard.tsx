import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ChevronsUpDown, Play, Briefcase, FileText, User, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { personioApi, type Employee } from "@/services/personioApi";
import { adminApi, type Catalog } from "@/services/adminApi";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
    teamName: z.string().min(1, "Projekt wählen"),
    catalogId: z.string().min(1, "Katalog wählen"),
    employeeId: z.string().min(1, "Mitarbeiter wählen"),
});

export function NewEvaluationWizard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Data State
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [allCatalogs, setAllCatalogs] = useState<Catalog[]>([]);

    // Open State for Dropdowns (to force styling)
    const [teamOpen, setTeamOpen] = useState(false);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [employeeOpen, setEmployeeOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            teamName: "",
            catalogId: "",
            employeeId: "",
        },
    });

    const selectedTeamName = form.watch("teamName");
    const selectedCatalogId = form.watch("catalogId");
    const selectedEmployeeId = form.watch("employeeId");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [empData, catData] = await Promise.all([
                    personioApi.getEmployees(),
                    adminApi.getCatalogs(),
                ]);
                setAllEmployees(empData);
                setAllCatalogs(catData);
            } catch (error) {
                console.error("Failed to load wizard data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (user?.teams && user.teams.length === 1 && !selectedTeamName) {
            form.setValue("teamName", user.teams[0].team.name);
        }
    }, [user, form, selectedTeamName]);

    const availableCatalogs = allCatalogs.filter(
        (c) => c.projects && c.projects.includes(selectedTeamName)
    );

    const availableEmployees = allEmployees.filter(
        (e) => e.rawTeams && e.rawTeams.includes(selectedTeamName)
    );

    function onSubmit(values: z.infer<typeof formSchema>) {
        const emp = allEmployees.find(e => e.id.toString() === values.employeeId);
        const cat = allCatalogs.find(c => c._id === values.catalogId);

        if (emp && cat) {
            navigate("/evaluation/new", {
                state: {
                    newEmployee: emp,
                    newCatalog: cat,
                    teamName: values.teamName,
                    mode: 'new'
                }
            });
        }
    }

    const isStep1Complete = !!selectedTeamName;
    const isStep2Complete = !!selectedCatalogId;
    const isStep3Complete = !!selectedEmployeeId;

    // Explicit Styles
    const openTriggerStyle = {
        borderColor: '#8d0808',
        boxShadow: '0 0 0 1px #8d0808'
    };

    const dropdownContentStyle = {
        backgroundColor: '#f4f4f5', // zinc-100/50 mix
        borderColor: '#8d0808',
        borderWidth: '1px',
        borderStyle: 'solid',
        width: '450px',
        minWidth: '100%'
    };

    const itemStyle = {
        cursor: 'pointer',
        padding: '12px 16px',
        borderBottom: '1px solid #e4e4e7',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '1rem 2rem', overflowX: 'auto', minHeight: '100vh', alignItems: 'flex-start' }}>
            <Card className="shadow-2xl bg-white border-0 ring-1 ring-zinc-200" style={{ minWidth: '1200px', width: '100%' }}>

                {/* Header padding drastically reduced to 0.5rem */}
                <CardHeader className="border-b bg-zinc-50/30" style={{ paddingBottom: '0.5rem', paddingTop: '0.5rem' }}>
                    <CardTitle className="tracking-tight text-zinc-900" style={{ fontSize: '2.5rem', fontWeight: 800, textAlign: 'center' }}>
                        Neue Beurteilung erstellen
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-10" style={{ paddingTop: '2.5rem' }}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">

                            <div style={{ display: 'flex', flexDirection: 'row', gap: '3rem', width: '100%', alignItems: 'stretch' }}>

                                {/* --- TEAM --- */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem', borderRadius: '1rem', border: isStep1Complete ? '2px solid #8d0808' : '1px solid #e4e4e7', backgroundColor: isStep1Complete ? 'rgba(141, 8, 8, 0.02)' : 'white', transition: 'all 0.3s ease' }}>
                                    <h3 className="text-2xl font-bold text-zinc-800 text-center">Team wählen</h3>

                                    <FormField
                                        control={form.control}
                                        name="teamName"
                                        render={({ field }) => (
                                            <FormItem className="w-full relative">
                                                <Select
                                                    onOpenChange={(open) => setTeamOpen(open)}
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        form.setValue("catalogId", "");
                                                        form.setValue("employeeId", "");
                                                    }}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            className="h-16 text-lg bg-white border-zinc-300 shadow-sm w-full px-4 transition-colors"
                                                            style={teamOpen ? openTriggerStyle : {}}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', gap: '1rem' }}>
                                                                <Briefcase className="w-6 h-6 text-zinc-500 shrink-0" />
                                                                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                                    {field.value || "Projekt..."}
                                                                </div>
                                                            </div>
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent
                                                        position="popper"
                                                        side="bottom"
                                                        align="center"
                                                        style={dropdownContentStyle}
                                                        className="shadow-xl"
                                                    >
                                                        {user?.teams?.map((ut) => (
                                                            <SelectItem
                                                                key={ut.team.id}
                                                                value={ut.team.name}
                                                                className="focus:bg-[#d4d4d8] focus:text-zinc-900 cursor-pointer"
                                                                style={itemStyle}
                                                            >
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <span className="font-medium text-zinc-800">{ut.team.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* --- KATALOG --- */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem', borderRadius: '1rem', border: isStep2Complete ? '2px solid #8d0808' : '1px solid #e4e4e7', backgroundColor: isStep2Complete ? 'rgba(141, 8, 8, 0.02)' : 'white', pointerEvents: !isStep1Complete ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
                                    <h3 className="text-2xl font-bold text-zinc-800 text-center">Katalog wählen</h3>

                                    <FormField
                                        control={form.control}
                                        name="catalogId"
                                        render={({ field }) => (
                                            <FormItem className="w-full relative">
                                                <Select
                                                    onOpenChange={(open) => setCatalogOpen(open)}
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        form.setValue("employeeId", "");
                                                    }}
                                                    value={field.value}
                                                    disabled={!selectedTeamName}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            className="h-16 text-lg bg-white border-zinc-300 shadow-sm w-full px-4 transition-colors"
                                                            style={catalogOpen ? openTriggerStyle : {}}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', gap: '1rem' }}>
                                                                <FileText className="w-6 h-6 text-zinc-500 shrink-0" />
                                                                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                                    {field.value
                                                                        ? allCatalogs.find(c => c._id === field.value)?.name
                                                                        : !selectedTeamName ? "Warte auf Team..." : "Katalog..."
                                                                    }
                                                                </div>
                                                            </div>
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent
                                                        position="popper"
                                                        side="bottom"
                                                        align="center"
                                                        style={dropdownContentStyle}
                                                        className="shadow-xl"
                                                    >
                                                        {availableCatalogs.map((cat) => (
                                                            <SelectItem
                                                                key={cat._id}
                                                                value={cat._id}
                                                                className="focus:bg-[#d4d4d8] focus:text-zinc-900 cursor-pointer"
                                                                style={itemStyle}
                                                            >
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <span className="font-medium text-zinc-800">{cat.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                        {availableCatalogs.length === 0 && selectedTeamName && (
                                                            <div className="p-4 text-center text-sm text-zinc-500">Keine Kataloge verfügbar</div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* --- MITARBEITER --- */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem', borderRadius: '1rem', border: isStep3Complete ? '2px solid #8d0808' : '1px solid #e4e4e7', backgroundColor: isStep3Complete ? 'rgba(141, 8, 8, 0.02)' : 'white', pointerEvents: !isStep2Complete ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
                                    <h3 className="text-2xl font-bold text-zinc-800 text-center">Mitarbeiter wählen</h3>

                                    <FormField
                                        control={form.control}
                                        name="employeeId"
                                        render={({ field }) => (
                                            <FormItem className="w-full relative">
                                                <Popover
                                                    open={employeeOpen}
                                                    onOpenChange={setEmployeeOpen}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={employeeOpen}
                                                                disabled={!selectedCatalogId}
                                                                className="w-full h-16 text-lg bg-white border-zinc-300 shadow-sm relative px-4 text-left font-normal"
                                                                style={{
                                                                    justifyContent: 'flex-start',
                                                                    ...(employeeOpen ? openTriggerStyle : {})
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', gap: '1rem' }}>
                                                                    <User className="w-6 h-6 text-zinc-500 shrink-0" />
                                                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                                        {field.value
                                                                            ? availableEmployees.find((e) => e.id.toString() === field.value)?.fullName
                                                                            : !selectedCatalogId ? "Warte auf Katalog..." : "Mitarbeiter..."}
                                                                    </span>
                                                                </div>
                                                                <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50 absolute right-4" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        align="center"
                                                        side="bottom"
                                                        style={dropdownContentStyle}
                                                        className="p-0 shadow-xl"
                                                    >
                                                        {/* Force background on Command container too */}
                                                        <Command style={{ backgroundColor: '#f4f4f5', width: '100%' }}>
                                                            <CommandInput placeholder="Name suchen..." className="h-12 text-base bg-[#f4f4f5]" />
                                                            <CommandEmpty className="py-6 text-center text-zinc-500 bg-[#f4f4f5]">Nichts gefunden.</CommandEmpty>
                                                            <CommandGroup className="max-h-[300px] overflow-y-auto w-full p-0 bg-[#f4f4f5]">
                                                                {availableEmployees.map((emp) => (
                                                                    <CommandItem
                                                                        value={emp.fullName}
                                                                        key={emp.id}
                                                                        onSelect={() => {
                                                                            form.setValue("employeeId", emp.id.toString());
                                                                            setEmployeeOpen(false);
                                                                        }}
                                                                        className="aria-selected:bg-[#d4d4d8] aria-selected:text-zinc-900 w-full cursor-pointer"
                                                                        style={itemStyle}
                                                                    >
                                                                        <div className="flex items-center w-full">
                                                                            {/* CHECKMARK LEFT - Reserved space */}
                                                                            <div style={{ width: '24px', display: 'flex', justifyContent: 'center', marginRight: '8px', flexShrink: 0 }}>
                                                                                {emp.id.toString() === field.value && (
                                                                                    <Check className="h-4 w-4 text-[#8d0808]" />
                                                                                )}
                                                                            </div>
                                                                            <span className="font-medium text-zinc-800">{emp.fullName}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                            </div>

                            {/* Centered Submit Button */}
                            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '6rem', paddingBottom: '3rem' }}>
                                <Button
                                    type="submit"
                                    className="h-16 px-20 text-xl font-bold rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                    disabled={!isStep3Complete}
                                >
                                    <Play className="mr-4 h-6 w-6 fill-current" />
                                    Bewertung jetzt starten
                                </Button>
                            </div>

                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
