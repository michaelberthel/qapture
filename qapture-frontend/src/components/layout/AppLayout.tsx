import { useState } from 'react';
import {
    Box,
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Assessment as AssessmentIcon,
    People as PeopleIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    List as ListIcon,
    Security as SecurityIcon,
    ExitToApp as ExitToAppIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert } from '@mui/material';

const drawerWidth = 260;

export default function AppLayout() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, impersonateUser, stopImpersonation, isImpersonating, originalUser } = useAuth();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    // Impersonation State
    const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
    const [impersonateEmail, setImpersonateEmail] = useState('');

    const handleImpersonateSubmit = async () => {
        if (impersonateEmail) {
            await impersonateUser(impersonateEmail);
            setImpersonateDialogOpen(false);
            setImpersonateEmail('');
            handleProfileMenuClose();
            navigate('/dashboard'); // Go to dashboard to see simulated view
        }
    };

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setAnchorEl(null);
    };

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['Admin', 'ProjektQM', 'ProjektKoordinator'] },
        { text: 'Neue Beurteilung', icon: <AssessmentIcon />, path: '/evaluations', roles: ['Admin', 'ProjektQM', 'ProjektKoordinator'] },
        { text: 'Historie', icon: <ListIcon />, path: '/history', roles: ['Admin', 'ProjektQM', 'ProjektKoordinator'] },
        { text: 'Meine Beurteilungen', icon: <AssessmentIcon />, path: '/my-evaluations', roles: ['Mitarbeiter'] },
        { text: 'Teams', icon: <PeopleIcon />, path: '/teams', roles: ['Admin', 'ProjektQM', 'ProjektKoordinator'] },
        { text: 'Verwaltung', icon: <SettingsIcon />, path: '/admin', roles: ['Admin'] },
    ];

    const filteredMenuItems = menuItems.filter(item =>
        user?.role && item.roles.includes(user.role)
    );

    const drawer = (
        <Box>
            <Toolbar>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                    <img src="/src/assets/logo.png" alt="Qapture Logo" style={{ maxWidth: '100%', maxHeight: '160px' }} />
                </Box>
            </Toolbar>
            <Divider />
            <List>
                {filteredMenuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => {
                                navigate(item.path);
                                if (isMobile) setMobileOpen(false);
                            }}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: theme.palette.primary.main,
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.dark,
                                    },
                                    '& .MuiListItemIcon-root': {
                                        color: 'white',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    color: location.pathname === item.path ? 'white' : 'inherit',
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    ml: { md: `${drawerWidth}px` },
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {menuItems.find(item => item.path === location.pathname)?.text || 'Quality Management'}
                    </Typography>
                    <IconButton
                        onClick={handleProfileMenuOpen}
                        color="inherit"
                    >
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                            {user?.displayName?.charAt(0) || 'U'}
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleProfileMenuClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                    >
                        <MenuItem disabled>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>
                                    {user?.displayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {user?.email}
                                </Typography>
                                <Typography variant="caption" display="block" color="primary">
                                    {user?.role}
                                </Typography>
                            </Box>
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => { handleProfileMenuClose(); logout(); }}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            Abmelden
                        </MenuItem>

                        {/* Admin Impersonation Controls */}
                        {user?.role === 'Admin' && !isImpersonating && (
                            <>
                                <Divider />
                                <MenuItem onClick={() => setImpersonateDialogOpen(true)}>
                                    <ListItemIcon>
                                        <SecurityIcon fontSize="small" />
                                    </ListItemIcon>
                                    Benutzer simulieren
                                </MenuItem>
                            </>
                        )}

                        {isImpersonating && (
                            <>
                                <Divider />
                                <MenuItem onClick={() => stopImpersonation()}>
                                    <ListItemIcon>
                                        <ExitToAppIcon fontSize="small" color="error" />
                                    </ListItemIcon>
                                    <Typography color="error">Simulation beenden</Typography>
                                </MenuItem>
                            </>
                        )}
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Impersonation Dialog */}
            <Dialog open={impersonateDialogOpen} onClose={() => setImpersonateDialogOpen(false)}>
                <DialogTitle>Benutzer simulieren</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Geben Sie die E-Mail-Adresse des Benutzers ein, als der Sie sich ausgeben möchten.
                        Sie sehen dann die Anwendung genau so, wie dieser Benutzer sie sieht (Rollen, Berechtigungen, Daten).
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="impersonate-email"
                        label="E-Mail Adresse"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={impersonateEmail}
                        onChange={(e) => setImpersonateEmail(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImpersonateDialogOpen(false)}>Abbrechen</Button>
                    <Button onClick={handleImpersonateSubmit} variant="contained" color="secondary">
                        Simulieren
                    </Button>
                </DialogActions>
            </Dialog>

            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile.
                    }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    mt: 8,
                    minHeight: '100vh',
                    backgroundColor: 'background.default',
                }}
            >
                {/* Visual Indicator for Impersonation */}
                {isImpersonating && originalUser && (
                    <Alert severity="warning" sx={{ mb: 2 }} action={
                        <Button color="inherit" size="small" onClick={() => stopImpersonation()}>
                            BEENDEN
                        </Button>
                    }>
                        <strong>SIMULATIONS-RODUS AKTIV:</strong> Sie sind aktuell eingeloggt als <strong>{user?.displayName} ({user?.email})</strong>.
                    </Alert>
                )}

                <Outlet />
            </Box>
        </Box>
    );
}
