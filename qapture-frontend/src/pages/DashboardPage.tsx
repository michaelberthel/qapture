import { useEffect, useState, useMemo } from 'react';
import {
    Box, Grid, Paper, Typography, Tab, Tabs, Card, CardContent, CircularProgress,
    TextField, MenuItem, FormControl, InputLabel, Select, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Alert, type SelectChangeEvent
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardMetric {
    count: number;
    avgScore: number;
    lastDate: string | null;
    trendData: any[];
}

import { evaluationApi } from '../services/api';
import { adminApi } from '../services/adminApi';

// Mapping legacy/evaluation catalog names to current Catalog Definitions
const CATALOG_NAME_MAPPING: Record<string, string> = {
    "Telefonie - Inbound": "Bewertung Inbound",
    "Telefonie - Outbound": "Bewertung Outbound",
    "Chat Bearbeitung": "Bewertung Chat",
    "QM Bewertung": "Bewertung Inbound", // Map legacy name
    "Inbound": "Bewertung Inbound" // Map Targo project name
};

export default function DashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [catalogs, setCatalogs] = useState<any[]>([]); // Store catalog definitions
    const [activeTab, setActiveTab] = useState(0); // 0 = Received, 1 = Given, 2 = Global, 3 = Analysis, 4 = Stats

    // Mapping Data
    const [dimensions, setDimensions] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});

    // Filter States for Admin View
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedCatalog, setSelectedCatalog] = useState('All');
    const [selectedEvaluator, setSelectedEvaluator] = useState('All');
    const [selectedEmployee, setSelectedEmployee] = useState('All');

    // Filter States for Statistics View
    const [statsTeam, setStatsTeam] = useState('All');
    const [statsCatalog, setStatsCatalog] = useState('All');
    const [statsEvaluator, setStatsEvaluator] = useState('All');
    const [statsEmployee, setStatsEmployee] = useState('All');

    // Filter States for Analysis View (Visualizations)


    const [analysisTeam, setAnalysisTeam] = useState('All');
    const [analysisCatalog, setAnalysisCatalog] = useState('All');
    const [analysisEvaluator, setAnalysisEvaluator] = useState('All');
    const [analysisEmployee, setAnalysisEmployee] = useState('All');
    const [analysisDateFrom, setAnalysisDateFrom] = useState('');
    const [analysisDateTo, setAnalysisDateTo] = useState('');

    // Grouping Mode
    const [groupingMode, setGroupingMode] = useState<'project' | 'evaluator' | 'employee'>('project');

    // Metrics State (Personal/Given/Global)
    const [receivedMetrics, setReceivedMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });
    const [givenMetrics, setGivenMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });
    const [globalMetrics, setGlobalMetrics] = useState<DashboardMetric>({ count: 0, avgScore: 0, lastDate: null, trendData: [] });

    // Initial Data Fetch
    useEffect(() => {
        const load = async () => {
            console.log("Dashboard Load: User:", user);
            try {
                // Fetch evaluations
                // Pass current user context explicitly to ensure headers are correct 
                if (user) {
                    const data = await evaluationApi.getAll(user);
                    console.log("Dashboard Load: Raw Data from API:", data);
                    setEvaluations(data);
                }

                // Fetch catalog definitions and mappings
                const [cats, dims, maps] = await Promise.all([
                    adminApi.getCatalogs(),
                    adminApi.getDimensions(),
                    adminApi.getMappings()
                ]);
                setCatalogs(cats);
                setDimensions(dims);

                const mapObj: Record<string, string> = {};
                maps.forEach((m: any) => {
                    if (m.dimensionId) mapObj[m.categoryName] = m.dimensionId;
                });
                setMappings(mapObj);

            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            load();
        }
    }, [user]);

    // Build Catalog Lookup Map: CatalogName -> QuestionName -> { Category, MaxScore, Type }
    const catalogLookup = useMemo(() => {
        const lookup = new Map<string, Map<string, { category: string, max: number, type: string }>>();
        catalogs.forEach(cat => {
            if (!cat.jsonData) return;
            try {
                const json = typeof cat.jsonData === 'string' ? JSON.parse(cat.jsonData) : cat.jsonData;
                const questionMap = new Map<string, { category: string, max: number, type: string }>();

                if (json.pages && Array.isArray(json.pages)) {
                    json.pages.forEach((page: any) => {
                        const category = page.name || page.title || 'Other';
                        if (page.elements && Array.isArray(page.elements)) {
                            page.elements.forEach((el: any) => {
                                if (el.name) {
                                    // Determina max score. Default to 1 if not specified (e.g. boolean), or rateMax for ratings.
                                    let max = 1;
                                    if (el.type === 'rating') {
                                        max = el.rateMax || 5;
                                    } else if (el.type === 'radiogroup' || el.type === 'boolean') {
                                        max = 1;
                                    }
                                    questionMap.set(el.name, { category, max, type: el.type });
                                }
                            });
                        }
                    });
                }
                lookup.set(cat.name, questionMap);
            } catch (e) {
                console.error('Error parsing catalog JSON', e);
            }
        });
        return lookup;
    }, [catalogs]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'count', direction: 'desc' });

    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const [dPart, tPart] = dateStr.split(', ');
        if (!dPart) return new Date();

        const parts = dPart.split('.');
        if (parts.length !== 3) return new Date();

        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];

        return new Date(`${year}-${month}-${day}T${tPart || '00:00:00'}`);
    };

    const isAnonymized = (email: string) => {
        if (!email) return false;
        // Check if @verbaneum.de exists
        if (!email.includes('@verbaneum.de')) return false;
        // Get part before @
        const localPart = email.split('@')[0];
        // If it DOES NOT contain a dot, it is anonymized (e.g. 123456)
        // Regular names are first.last
        return !localPart.includes('.');
    };

    // Recalculate Basic Metrics (Tabs 0-2)
    useEffect(() => {
        if (!user) return;

        // 1. Calculate Personal & Given (Unfiltered by dashboard filters, always user specific)
        const received = evaluations.filter(e =>
            e.name?.toLowerCase() === user.email?.toLowerCase() ||
            e.fullData?.surveyresults?.EmployeeEmail?.toLowerCase() === user.email?.toLowerCase() ||
            e.fullData?.surveyresults?.Email?.toLowerCase() === user.email?.toLowerCase()
        );
        const given = evaluations.filter(e =>
            e.bewerter?.toLowerCase() === user.email?.toLowerCase() ||
            e.fullData?.surveyresults?.EvaluatorEmail?.toLowerCase() === user.email?.toLowerCase()
        );

        setReceivedMetrics(processStats(received));
        setGivenMetrics(processStats(given));

        // 2. Calculate Global (Admin only) - Filtered
        if (user.role === 'Admin') {
            let filtered = [...evaluations];

            // Filter Date Range
            if (dateFrom) {
                const dFrom = new Date(dateFrom);
                filtered = filtered.filter(e => parseDate(e.datum) >= dFrom);
            }
            if (dateTo) {
                // Set to End of Day
                const dToTime = new Date(dateTo);
                dToTime.setHours(23, 59, 59, 999);
                filtered = filtered.filter(e => parseDate(e.datum) <= dToTime);
            }

            // Filter Team (Multi)
            if (selectedTeams.length > 0) {
                filtered = filtered.filter(e => selectedTeams.includes(e.projekt));
            }

            // Filter Catalog
            if (selectedCatalog !== 'All') {
                filtered = filtered.filter(e => e.kriterienkatalog === selectedCatalog);
            }

            // Filter Evaluator
            if (selectedEvaluator !== 'All') {
                filtered = filtered.filter(e => e.bewerter === selectedEvaluator);
            }

            // Filter Employee
            if (selectedEmployee !== 'All') {
                filtered = filtered.filter(e => e.name === selectedEmployee);
            }

            setGlobalMetrics(processStats(filtered));
        }
    }, [evaluations, user, dateFrom, dateTo, selectedTeams, selectedCatalog, selectedEvaluator, selectedEmployee]);

    // Derived Filtered Data for Stats Tab
    const filteredStatsData = useMemo(() => {
        let statsData = [...evaluations];
        if (statsTeam !== 'All') statsData = statsData.filter(e => e.projekt === statsTeam);
        if (statsCatalog !== 'All') statsData = statsData.filter(e => e.kriterienkatalog === statsCatalog);
        if (statsEvaluator !== 'All') statsData = statsData.filter(e => e.bewerter === statsEvaluator);
        if (statsEmployee !== 'All') statsData = statsData.filter(e => e.name === statsEmployee);
        return statsData;
    }, [evaluations, statsTeam, statsCatalog, statsEvaluator, statsEmployee]);

    // Derived Filtered Data for Analysis Tab
    const filteredAnalysisData = useMemo(() => {
        let analysisDataVals = [...evaluations];
        if (analysisTeam !== 'All') analysisDataVals = analysisDataVals.filter(e => e.projekt === analysisTeam);
        if (analysisCatalog !== 'All') analysisDataVals = analysisDataVals.filter(e => e.kriterienkatalog === analysisCatalog);
        if (analysisEvaluator !== 'All') analysisDataVals = analysisDataVals.filter(e => e.bewerter === analysisEvaluator);
        if (analysisEmployee !== 'All') analysisDataVals = analysisDataVals.filter(e => e.name === analysisEmployee);

        if (analysisDateFrom) {
            const dFrom = new Date(analysisDateFrom);
            analysisDataVals = analysisDataVals.filter(e => parseDate(e.datum) >= dFrom);
        }
        if (analysisDateTo) {
            const dToTime = new Date(analysisDateTo);
            dToTime.setHours(23, 59, 59, 999);
            analysisDataVals = analysisDataVals.filter(e => parseDate(e.datum) <= dToTime);
        }

        return analysisDataVals;
    }, [evaluations, analysisTeam, analysisCatalog, analysisEvaluator, analysisEmployee, analysisDateFrom, analysisDateTo]);

    const calculateDetailedStats = (data: any[]) => {
        if (data.length === 0) return { count: 0, avg: "0.0", oldest: '-', newest: '-', daysSince: '-' };

        const sorted = [...data].sort((a, b) => parseDate(a.datum).getTime() - parseDate(b.datum).getTime());
        const totalScore = sorted.reduce((acc, curr) => acc + (typeof curr.prozent === 'number' ? curr.prozent : 0), 0);
        const avg = totalScore / sorted.length;

        const oldest = sorted[0].datum.split(',')[0];
        const newest = sorted[sorted.length - 1].datum.split(',')[0];

        const newestDate = parseDate(sorted[sorted.length - 1].datum);
        const diffTime = Math.abs(new Date().getTime() - newestDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
            count: data.length,
            avg: avg.toFixed(1),
            oldest,
            newest,
            daysSince: diffDays
        };
    };

    const statsMetrics = useMemo(() => calculateDetailedStats(filteredStatsData), [filteredStatsData]);

    const groupedStatsData = useMemo(() => {
        const groups: Record<string, any[]> = {};

        filteredStatsData.forEach(item => {
            let key = '';
            if (groupingMode === 'project') key = item.projekt;
            else if (groupingMode === 'evaluator') key = item.bewerter;
            else if (groupingMode === 'employee') key = item.name;
            else key = 'Unknown'; // Fallback, though data should always have these fields

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let rows = Object.keys(groups).map(key => {
            if (groupingMode === 'evaluator' || groupingMode === 'employee') {
                if (isAnonymized(key)) return null;
            }
            const stats = calculateDetailedStats(groups[key]);
            return { key, ...stats };
        }).filter(Boolean) as any[];

        if (sortConfig.key) {
            rows.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (sortConfig.key === 'avg') {
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }
                if (sortConfig.key === 'newest') {
                    const parseSortDate = (str: string) => {
                        if (str === '-') return 0;
                        const [d, m, y] = str.split('.');
                        return new Date(`${y}-${m}-${d}`).getTime();
                    };
                    aValue = parseSortDate(aValue);
                    bValue = parseSortDate(bValue);
                }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [filteredStatsData, groupingMode, sortConfig]);

    // --- DATA PREPARATION FOR VISUALIZATIONS ---
    const analysisData = useMemo(() => {
        // 1. Histogram (Score Distribution)
        const buckets = [
            { range: '0-50%', count: 0 },
            { range: '50-70%', count: 0 },
            { range: '70-80%', count: 0 },
            { range: '80-90%', count: 0 },
            { range: '90-100%', count: 0 },
        ];

        filteredAnalysisData.forEach(e => {
            const score = typeof e.prozent === 'number' ? e.prozent : 0;
            if (score <= 50) buckets[0].count++;
            else if (score <= 70) buckets[1].count++;
            else if (score <= 80) buckets[2].count++;
            else if (score <= 90) buckets[3].count++;
            else buckets[4].count++;
        });

        // 2. Radar Chart (REAL DATA)
        const categoryStats = new Map<string, { sum: number, count: number }>();

        filteredAnalysisData.forEach(e => {
            const rawName = e.kriterienkatalog;
            const catName = CATALOG_NAME_MAPPING[rawName] || rawName;
            const map = catalogLookup.get(catName);

            if (!map) {
                console.warn(`[Radar] No map found for catalog: ${catName} (raw: ${rawName})`);
                return;
            }

            const answers = e.fullData || {};
            if (e.fullData && e.fullData.surveyresults) {
                // Handle nested structure if necessary (legacy vs new)
                Object.assign(answers, e.fullData.surveyresults);
            }



            let matchCount = 0;
            Object.entries(answers).forEach(([qName, qValue]) => {
                const info = map.get(qName);
                if (info) {
                    const { category, max, type } = info;

                    // Filter: Only allow 'rating', 'boolean', 'radiogroup'
                    if (type !== 'rating' && type !== 'boolean' && type !== 'radiogroup') return;

                    matchCount++;
                    if (typeof max !== 'number' || max <= 0) return; // Prevent division by zero

                    let numVal = 0;
                    if (typeof qValue === 'number') numVal = qValue;
                    else if (typeof qValue === 'string' && !isNaN(Number(qValue))) numVal = Number(qValue);
                    else return;

                    let percent = (numVal / max) * 100;
                    if (isNaN(percent) || !isFinite(percent)) percent = 0; // Guard against bad math
                    if (percent > 100) percent = 100; // Cap at 100% for legacy mismatches

                    // Determine Group Key (Category or Dimension)
                    let groupKey = category;

                    // IF no specific catalog selected, use Dimension Mapping
                    if (selectedCatalog === 'All') {
                        const dimId = mappings[category];
                        if (dimId) {
                            const dim = dimensions.find(d => d._id === dimId);
                            if (dim) groupKey = dim.name;
                            else groupKey = 'Sonstiges'; // ID valid but dim missing
                        } else {
                            groupKey = 'Sonstiges'; // Not mapped
                        }
                    }

                    if (!categoryStats.has(groupKey)) {
                        categoryStats.set(groupKey, { sum: 0, count: 0 });
                    }
                    const stat = categoryStats.get(groupKey)!;
                    stat.sum += percent;
                    stat.count++;
                }
            });

        });

        const radarData = Array.from(categoryStats.entries()).map(([subject, stats]) => {
            let avg = stats.count > 0 ? stats.sum / stats.count : 0;
            if (isNaN(avg) || !isFinite(avg)) avg = 0;
            return {
                subject,
                A: Math.round(avg),
                fullMark: 100
            };
        });

        // Sort categories to make the chart consistent
        radarData.sort((a, b) => a.subject.localeCompare(b.subject));

        // 3. Question Statistics (Average Score per Question)
        const questionStats: { question: string, fullQuestion: string, sum: number, count: number, max: number }[] = [];

        // Only calculate if a catalog is selected (or at least filtering by team ensures meaningful context)
        // User requested: "only when project and maybe catalog is filtered"
        // Let's allow it if Team OR Catalog is selected.
        if (analysisTeam !== 'All' || analysisCatalog !== 'All') {
            filteredAnalysisData.forEach(e => {
                const rawName = e.kriterienkatalog;
                // Use mapping to find definition
                const catName = CATALOG_NAME_MAPPING[rawName] || rawName;
                const map = catalogLookup.get(catName);

                if (!map) return;

                const answers = e.fullData || {};
                if (e.fullData && e.fullData.surveyresults) {
                    Object.assign(answers, e.fullData.surveyresults);
                }

                Object.entries(answers).forEach(([qName, qValue]) => {
                    const info = map.get(qName);
                    if (info) {
                        // found question definition
                        const { max, type } = info;

                        // Filter: Only allow scorable types
                        if (type !== 'rating' && type !== 'boolean' && type !== 'radiogroup') return;

                        let numVal = 0;
                        if (typeof qValue === 'number') numVal = qValue;
                        else if (typeof qValue === 'string' && !isNaN(Number(qValue))) numVal = Number(qValue);
                        else return;

                        let percent = (numVal / max) * 100;
                        if (isNaN(percent)) percent = 0;
                        if (percent > 100) percent = 100; // Cap at 100%

                        // Find existing stat entry or create
                        let stat = questionStats.find(s => s.question === qName);
                        if (!stat) {
                            stat = { question: qName, fullQuestion: qName, sum: 0, count: 0, max };
                            questionStats.push(stat);
                        }
                        stat.sum += percent;
                        stat.count++;
                    }
                });
            });
        }

        const questionData = questionStats.map(s => ({
            question: s.question,
            avg: Math.round(s.sum / s.count),
            count: s.count
        })).sort((a, b) => a.avg - b.avg); // Sort by lowest score first? Or alphabetical? Let's do score asc (weakest first)

        return { histogram: buckets, radar: radarData, count: filteredAnalysisData.length, questions: questionData };
    }, [filteredAnalysisData, catalogLookup, selectedCatalog, mappings, dimensions, analysisTeam, analysisCatalog]);

    // 4. Action Required Stats (Pie Chart)
    const actionRequiredStats = useMemo(() => {
        let yesCount = 0;
        let noCount = 0;
        let total = 0;

        filteredAnalysisData.forEach(e => {
            if (!e.fullData || !e.fullData.surveyresults) return;
            const res = e.fullData.surveyresults;

            // Find "Action Required" / "Handlungsbedarf" key
            const actionKey = Object.keys(res).find(k =>
                k.toLowerCase().includes('handlungsbedarf') ||
                k.toLowerCase().includes('action') ||
                k.toLowerCase().includes('aktion')
            );

            if (actionKey) {
                const val = res[actionKey];
                // Check for generic affirmative values
                const isYes = val === true || val === 'true' || val === 'True' ||
                    val === 'Yes' || val === 'yes' || val === 'Ja' || val === 'ja';

                if (isYes) yesCount++;
                else noCount++;
                total++;
            }
        });

        if (total === 0) return [];

        return [
            { name: 'Handlungsbedarf', value: yesCount },
            { name: 'Kein Handlungsbedarf', value: noCount }
        ];
    }, [filteredAnalysisData]);

    const ACTION_COLORS = ['#d32f2f', '#2e7d32']; // Red, Green

    // 4. Trend Analysis Data (Daily Averages)
    const analysisTrendData = useMemo(() => {
        const groups = new Map<string, { sum: number, count: number }>();

        filteredAnalysisData.forEach(e => {
            if (!e.datum) return;
            const dateObj = parseDate(e.datum);
            // Format to YYYY-MM-DD for grouping
            const key = dateObj.toISOString().split('T')[0];

            const score = typeof e.prozent === 'number' ? e.prozent : 0;

            if (!groups.has(key)) {
                groups.set(key, { sum: 0, count: 0 });
            }
            const g = groups.get(key)!;
            g.sum += score;
            g.count++;
        });

        const data = Array.from(groups.entries()).map(([date, { sum, count }]) => ({
            date,
            formattedDate: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
            score: Math.round((sum / count) * 10) / 10 // Round to 1 decimal
        }));

        // Sort by date
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return data;
    }, [filteredAnalysisData]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const processStats = (subset: any[]): DashboardMetric => {
        if (subset.length === 0) return { count: 0, avgScore: 0, lastDate: null, trendData: [] };
        const sorted = [...subset].sort((a, b) => {
            const dateA = parseDate(a.datum);
            const dateB = parseDate(b.datum);
            return dateA.getTime() - dateB.getTime();
        });
        const totalScore = sorted.reduce((acc, curr) => {
            const val = typeof curr.prozent === 'number' && !isNaN(curr.prozent) ? curr.prozent : 0;
            return acc + val;
        }, 0);
        const avg = sorted.length > 0 ? totalScore / sorted.length : 0;
        const trend = sorted.map(e => ({
            date: e.datum.split(',')[0],
            score: e.prozent,
            name: e.name
        }));
        return {
            count: subset.length,
            avgScore: parseFloat(avg.toFixed(1)),
            lastDate: sorted[sorted.length - 1].datum,
            trendData: trend
        };
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const uniqueTeams = useMemo(() => Array.from(new Set(evaluations.map(e => e.projekt))).filter(Boolean).sort(), [evaluations]);

    // Dependent Catalog List for Analysis Tab
    // If a team is selected, show only catalogs used by that team
    const uniqueCatalogsAnalysis = useMemo(() => {
        let source = evaluations;
        if (analysisTeam !== 'All') {
            source = source.filter(e => e.projekt === analysisTeam);
        }
        return Array.from(new Set(source.map(e => e.kriterienkatalog))).filter(Boolean).sort();
    }, [evaluations, analysisTeam]);

    // For other tabs (Global Filter), we might want similar behavior or keep it global?
    // User specifically asked for "Dropdown zur Filterung" in the context of "Startseite -> Auswertungen" (which is this tabs logic).
    // Let's assume Global Filter should also be dependent if we want consistency, but user focused on Analysis.
    // Let's update Global Filter as well for consistency.
    const uniqueCatalogsGlobal = useMemo(() => {
        let source = evaluations;
        if (selectedTeams.length > 0) {
            source = source.filter(e => selectedTeams.includes(e.projekt));
        }
        return Array.from(new Set(source.map(e => e.kriterienkatalog))).filter(Boolean).sort();
    }, [evaluations, selectedTeams]);

    // Independent lists for others
    const uniqueCatalogs = useMemo(() => Array.from(new Set(evaluations.map(e => e.kriterienkatalog))).filter(Boolean).sort(), [evaluations]);
    const uniqueEvaluators = useMemo(() => Array.from(new Set(evaluations.map(e => e.bewerter))).filter(Boolean), [evaluations]);
    const uniqueEmployees = useMemo(() => Array.from(new Set(evaluations.map(e => e.name))).filter(Boolean), [evaluations]);

    const getChartTitle = () => {
        if (activeTab === 2) return 'Unternehmensweite Leistungsentwicklung';
        if (activeTab === 1) return 'Entwicklung der vergebenen Bewertungen';
        return 'Leistungsentwicklung';
    };

    const resetFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSelectedTeams([]);
        setSelectedCatalog('All');
        setSelectedEvaluator('All');
        setSelectedEmployee('All');
    };

    const resetStatsFilters = () => {
        setStatsTeam('All');
        setStatsCatalog('All');
        setStatsEvaluator('All');
        setStatsEmployee('All');
    };

    const resetAnalysisFilters = () => {
        setAnalysisTeam('All');
        setAnalysisCatalog('All');
        setAnalysisEvaluator('All');
        setAnalysisEvaluator('All');
        setAnalysisEmployee('All');
        setAnalysisDateFrom('');
        setAnalysisDateTo('');
    };

    if (loading) {
        return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
    }

    const showGivenTab = user?.role !== 'Mitarbeiter';
    const showGlobalTab = user?.role === 'Admin';
    const showStatsTab = true;
    const showAnalysisTab = true;

    let tabIndex = 0;
    const tabIndices: Record<string, number> = { received: 0 };
    if (showGivenTab) { tabIndex++; tabIndices.given = tabIndex; }
    if (showGlobalTab) { tabIndex++; tabIndices.global = tabIndex; }
    tabIndex++; tabIndices.analysis = tabIndex;
    tabIndex++; tabIndices.stats = tabIndex;

    const isStatsTabActive = activeTab === tabIndices.stats;
    const isAnalysisTabActive = activeTab === tabIndices.analysis;

    let currentMetrics = receivedMetrics;
    if (showGivenTab && activeTab === tabIndices.given) currentMetrics = givenMetrics;
    else if (showGlobalTab && activeTab === tabIndices.global) currentMetrics = globalMetrics;

    const TableHeaderCell = ({ id, label, numeric }: { id: string, label: string, numeric?: boolean }) => (
        <TableCell
            align={numeric ? "right" : "left"}
            onClick={() => requestSort(id)}
            sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { backgroundColor: '#e0e0e0' } }}
        >
            <strong>{label}</strong>
            {sortConfig.key === id && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
        </TableCell>
    );

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Dashboard
            </Typography>

            <Paper elevation={1} sx={{ p: 2, mb: 4, display: 'flex', gap: 2, alignItems: 'center', backgroundColor: '#f9f9f9' }}>
                <Box>
                    <Typography variant="h6">{user?.displayName}</Typography>
                    <Typography variant="body2" color="textSecondary">{user?.email}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Rolle:</strong> {user?.role}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Teams:</strong> {user?.teams?.map(t => t.team.name).join(', ') || 'Keine'}
                    </Typography>
                </Box>
            </Paper>

            <Box borderBottom={1} borderColor="divider" mb={3}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label="Meine Leistung" />
                    {showGivenTab && <Tab label="Durchgeführte Bewertungen" />}
                    {showGlobalTab && <Tab label="Unternehmensweit" />}
                    {showAnalysisTab && <Tab label="Auswertungen" />}
                    {showStatsTab && <Tab label="Statistiken" />}
                </Tabs>
            </Box>

            {showGlobalTab && activeTab === tabIndices.global && (
                <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>Filter (Unternehmensweit)</Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Zeitraum von"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Zeitraum bis"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Teams / Projekte</InputLabel>
                                <Select
                                    multiple
                                    value={selectedTeams}
                                    label="Teams / Projekte"
                                    onChange={(e: SelectChangeEvent<typeof selectedTeams>) => {
                                        const { value } = e.target;
                                        setSelectedTeams(typeof value === 'string' ? value.split(',') : value);
                                    }}
                                    renderValue={(selected) => selected.join(', ')}
                                >
                                    {uniqueTeams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Kriterienkatalog</InputLabel>
                                <Select
                                    value={selectedCatalog}
                                    label="Kriterienkatalog"
                                    onChange={(e: SelectChangeEvent) => setSelectedCatalog(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueCatalogsGlobal.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Bewerter</InputLabel>
                                <Select
                                    value={selectedEvaluator}
                                    label="Bewerter"
                                    onChange={(e: SelectChangeEvent) => setSelectedEvaluator(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEvaluators.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Mitarbeiter</InputLabel>
                                <Select
                                    value={selectedEmployee}
                                    label="Mitarbeiter"
                                    onChange={(e: SelectChangeEvent) => setSelectedEmployee(e.target.value)}
                                >
                                    <MenuItem value="All">Alle</MenuItem>
                                    {uniqueEmployees.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} display="flex" justifyContent="flex-end">
                            <Button variant="text" onClick={resetFilters}>Filter zurücksetzen</Button>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {isAnalysisTabActive && (
                <Box>
                    <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                        <Typography variant="subtitle2" gutterBottom>Auswertungs-Filter</Typography>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={2}>
                                <TextField
                                    label="Zeitraum von"
                                    type="date"
                                    fullWidth
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    value={analysisDateFrom}
                                    onChange={(e) => setAnalysisDateFrom(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    label="Zeitraum bis"
                                    type="date"
                                    fullWidth
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    value={analysisDateTo}
                                    onChange={(e) => setAnalysisDateTo(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Projekt</InputLabel>
                                    <Select
                                        value={analysisTeam}
                                        label="Projekt"
                                        onChange={(e: SelectChangeEvent) => setAnalysisTeam(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueTeams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Kriterienkatalog</InputLabel>
                                    <Select
                                        value={analysisCatalog}
                                        label="Kriterienkatalog"
                                        onChange={(e: SelectChangeEvent) => setAnalysisCatalog(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueCatalogsAnalysis.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Bewerter</InputLabel>
                                    <Select
                                        value={analysisEvaluator}
                                        label="Bewerter"
                                        onChange={(e: SelectChangeEvent) => setAnalysisEvaluator(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueEvaluators.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Mitarbeiter</InputLabel>
                                    <Select
                                        value={analysisEmployee}
                                        label="Mitarbeiter"
                                        onChange={(e: SelectChangeEvent) => setAnalysisEmployee(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueEmployees.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={12} display="flex" justifyContent="flex-end">
                                <Button variant="text" onClick={resetAnalysisFilters}>Filter zurücksetzen</Button>
                            </Grid>
                        </Grid>
                    </Paper>



                    <Grid container spacing={4}>
                        {/* 1. Quality Trend Chart */}
                        <Grid item xs={12}>
                            <Paper elevation={2} sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>Qualitäts-Trend (Durchschnittsscore)</Typography>
                                <Box sx={{ height: 300, width: '100%' }}>
                                    <ResponsiveContainer>
                                        <LineChart data={analysisTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="formattedDate"
                                                tick={{ fontSize: 12 }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tick={{ fontSize: 12 }}
                                                label={{ value: 'Score %', angle: -90, position: 'insideLeft' }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #ccc' }}
                                                labelStyle={{ fontWeight: 'bold' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#2196f3"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#2196f3' }}
                                                activeDot={{ r: 6 }}
                                                name="Ø Score"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>

                        </Grid>

                        {/* 1.1 Action Required Quote (Donut Chart) */}
                        <Grid item xs={12} md={4}>
                            <Paper elevation={2} sx={{ p: 3, height: 400, display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" gutterBottom>Handlungsbedarfs-Quote</Typography>
                                {actionRequiredStats.length > 0 ? (
                                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={actionRequiredStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {actionRequiredStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={ACTION_COLORS[index % ACTION_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                ) : (
                                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                                        <Typography variant="body2" color="text.secondary">Keine Daten für Handlungsbedarf gefunden</Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={8}>
                            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Verteilung der Bewertungen</Typography>
                                <Typography variant="caption" color="textSecondary" display="block" mb={2}>
                                    Histogramm der erzielten Scores in Clustern (n={analysisData.count})
                                </Typography>
                                <Box height={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analysisData.histogram}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="range" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#8d0808" name="Anzahl" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Stärken-/Schwächen-Profil (Auswahl)</Typography>
                                <Typography variant="caption" color="textSecondary" display="block" mb={2}>
                                    Durchschnittliche Performance pro Kompetenzfeld (Real)
                                </Typography>
                                <Box height={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData.radar}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                            <Radar name="Durchschnitt" dataKey="A" stroke="#8d0808" fill="#8d0808" fillOpacity={0.6} />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>
                        </Grid>
                        {analysisData.questions && analysisData.questions.length > 0 ? (
                            <Grid item xs={12}>
                                <Paper elevation={2} sx={{ p: 3 }}>
                                    <Typography variant="h6" gutterBottom>Detail-Analyse: Durchschnitt pro Frage</Typography>
                                    <Typography variant="body2" color="textSecondary" mb={2}>
                                        Filterung aktiv: {analysisTeam !== 'All' ? analysisTeam : 'Alle Projekte'} / {analysisCatalog !== 'All' ? analysisCatalog : 'Alle Kataloge'}
                                    </Typography>
                                    <Box height={400}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={analysisData.questions}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" domain={[0, 100]} />
                                                <YAxis dataKey="question" type="category" width={180} tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Bar dataKey="avg" name="Ø Prozent" fill="#8884d8" barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                        ) : (
                            (analysisTeam !== 'All' || analysisCatalog !== 'All') && (
                                <Grid item xs={12}>
                                    <Alert severity="warning">
                                        <Typography variant="subtitle2">Keine Fragen-Daten verfügbar</Typography>
                                        Möglicherweise fehlen die Katalog-Definitionen für die gefilterten Bewertungen.
                                        Ohne diese Definitionen können die Fragen nicht identifiziert und ausgewertet werden.
                                        Bitte prüfen Sie unter "Einstellungen" -&gt; "Kategorie-Mapping" die Liste der fehlenden Kataloge.
                                    </Alert>
                                </Grid>
                            )
                        )}
                        <Grid item xs={12}>
                            <Paper elevation={1} sx={{ p: 2, bgcolor: '#fff3cd' }}>
                                <Typography variant="body2" color="black">
                                    <strong>Hinweis:</strong> Visualisierungen basieren auf {analysisData.count} gefilterten Datensätzen.
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box >
            )
            }

            {
                isStatsTabActive && (
                    <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                        <Typography variant="subtitle2" gutterBottom>Statistik-Filter</Typography>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Projekt</InputLabel>
                                    <Select
                                        value={statsTeam}
                                        label="Projekt"
                                        onChange={(e: SelectChangeEvent) => setStatsTeam(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueTeams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Kriterienkatalog</InputLabel>
                                    <Select
                                        value={statsCatalog}
                                        label="Kriterienkatalog"
                                        onChange={(e: SelectChangeEvent) => setStatsCatalog(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueCatalogs.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Bewerter</InputLabel>
                                    <Select
                                        value={statsEvaluator}
                                        label="Bewerter"
                                        onChange={(e: SelectChangeEvent) => setStatsEvaluator(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueEvaluators.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Mitarbeiter</InputLabel>
                                    <Select
                                        value={statsEmployee}
                                        label="Mitarbeiter"
                                        onChange={(e: SelectChangeEvent) => setStatsEmployee(e.target.value)}
                                    >
                                        <MenuItem value="All">Alle</MenuItem>
                                        {uniqueEmployees.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={12} display="flex" justifyContent="flex-end">
                                <Button variant="text" onClick={resetStatsFilters}>Filter zurücksetzen</Button>
                            </Grid>
                        </Grid>

                        <Box mt={4}>
                            <Typography variant="h6" gutterBottom>Gesamtübersicht</Typography>
                            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 4 }}>
                                <Grid container spacing={3}>
                                    <Grid item xs={6} md={2}>
                                        <Typography variant="body2" color="textSecondary">Anzahl Bewertungen</Typography>
                                        <Typography variant="h5">{statsMetrics.count}</Typography>
                                    </Grid>
                                    <Grid item xs={6} md={2}>
                                        <Typography variant="body2" color="textSecondary">Durchschnitt</Typography>
                                        <Typography variant="h5" color={parseFloat(statsMetrics.avg) >= 90 ? 'success.main' : parseFloat(statsMetrics.avg) >= 70 ? 'warning.main' : 'error.main'}>
                                            {statsMetrics.avg}%
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="body2" color="textSecondary">Älteste Bewertung</Typography>
                                        <Typography variant="body1">{statsMetrics.oldest}</Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="body2" color="textSecondary">Jüngste Bewertung</Typography>
                                        <Typography variant="body1">{statsMetrics.newest}</Typography>
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <Typography variant="body2" color="textSecondary">Tage seit letzter Bew.</Typography>
                                        <Typography variant="h5">{statsMetrics.daysSince}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>

                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6">Detaillierte Auswertung</Typography>
                                <ToggleButtonGroup
                                    color="primary"
                                    value={groupingMode}
                                    exclusive
                                    onChange={(_e, newMode) => { if (newMode) setGroupingMode(newMode); }}
                                    size="small"
                                >
                                    <ToggleButton value="project">Projekt/Team</ToggleButton>
                                    <ToggleButton value="evaluator">Bewerter</ToggleButton>
                                    <ToggleButton value="employee">Mitarbeiter</ToggleButton>
                                </ToggleButtonGroup>
                            </Box>

                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableHeaderCell id="key" label={groupingMode === 'project' ? 'Projekt/Team' : groupingMode === 'evaluator' ? 'Bewerter' : 'Mitarbeiter'} />
                                            <TableHeaderCell id="count" label="Anzahl" numeric />
                                            <TableHeaderCell id="avg" label="Ø Score" numeric />
                                            <TableHeaderCell id="newest" label="Letzte Bew." numeric />
                                            <TableHeaderCell id="daysSince" label="Tage her" numeric />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {groupedStatsData.length > 0 ? groupedStatsData.map((row) => (
                                            <TableRow key={row.key}>
                                                <TableCell>{row.key}</TableCell>
                                                <TableCell align="right">{row.count}</TableCell>
                                                <TableCell align="right">
                                                    <Typography color={parseFloat(row.avg) >= 90 ? 'success.main' : parseFloat(row.avg) >= 70 ? 'warning.main' : 'error.main'} variant="body2" fontWeight="bold">
                                                        {row.avg}%
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">{row.newest}</TableCell>
                                                <TableCell align="right">{row.daysSince}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center">Keine Daten verfügbar</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Paper>
                )
            }

            {
                !isStatsTabActive && !isAnalysisTabActive && (
                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} md={4}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Anzahl Bewertungen
                                    </Typography>
                                    <Typography variant="h3" color="primary">
                                        {currentMetrics.count}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Durchschnitt (Gesamt)
                                    </Typography>
                                    <Typography variant="h3" sx={{ color: currentMetrics.avgScore >= 90 ? 'success.main' : currentMetrics.avgScore >= 70 ? 'warning.main' : 'error.main' }}>
                                        {currentMetrics.avgScore}%
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Letzte Aktivität
                                    </Typography>
                                    <Typography variant="h5">
                                        {currentMetrics.lastDate || '-'}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )
            }

            {
                !isStatsTabActive && !isAnalysisTabActive && currentMetrics.count > 0 ? (
                    <Grid container spacing={3}>
                        <Grid item xs={12} lg={8}>
                            <Paper elevation={2} sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    {getChartTitle()}
                                </Typography>
                                <Box height={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={currentMetrics.trendData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis domain={[0, 100]} />
                                            <Tooltip />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#8d0808"
                                                strokeWidth={2}
                                                activeDot={{ r: 8 }}
                                                name="Prozentpunkte"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} lg={4}>
                            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>
                                    Hinweise
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    {activeTab === 0 && "Hier sehen Sie Ihre persönliche Leistungsentwicklung basierend auf den erhaltenen Bewertungen."}
                                    {activeTab === 1 && "Hier sehen Sie die Statistiken aller Bewertungen, die Sie als Bewerter durchgeführt haben."}
                                    {activeTab === 2 && "Übersicht über alle Bewertungen im Unternehmen."}
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                ) : (!isStatsTabActive && !isAnalysisTabActive) ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="textSecondary">Keine Daten vorhanden.</Typography>
                    </Paper>
                ) : null
            }
        </Box >
    );
}
