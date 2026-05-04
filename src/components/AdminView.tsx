import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Equipment, Rental, UserProfile, ShiftReport, EquipmentType, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Plus, Trash2, AlertCircle, DollarSign, CreditCard, Wallet, Anchor, 
  Key, UserPlus, Loader2, CheckCircle2, RefreshCcw
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

export default function AdminView({ user }: { user: UserProfile }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const fetchData = async () => {
    try {
      const [eqData, rentalData, reportData, userData] = await Promise.all([
        api.getEquipment(),
        api.getRentals(),
        api.getReports(),
        api.getUsers()
      ]);
      setEquipment(eqData.map((e: any) => ({ ...e, id: e._id })));
      setRentals(rentalData
        .map((r: any) => ({ ...r, id: r._id }))
        .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      );
      setReports(reportData
        .map((r: any) => ({ ...r, id: r._id }))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setUsers(userData.map((u: any) => ({ ...u, uid: u._id })));
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const [newEqName, setNewEqName] = useState('');
  const [newEqType, setNewEqType] = useState<EquipmentType>('Kajak');
  const [newEqRate, setNewEqRate] = useState(25);
  const [newEqHalfRate, setNewEqHalfRate] = useState(15);

  // Staff management
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('seller');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Password change
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmConfig({ open: true, title, description, onConfirm });
  };

  const handleAddEquipment = async () => {
    try {
      await api.createEquipment({
        name: newEqName,
        type: newEqType,
        hourlyRate: newEqRate,
        halfHourRate: newEqHalfRate,
        status: 'available'
      });
      toast.success('Dodano sprzęt');
      setNewEqName('');
      fetchData();
    } catch (error) {
      toast.error('Błąd dodawania sprzętu');
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffUsername || !newStaffPassword || !newStaffName) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }
    setIsAddingStaff(true);
    const username = newStaffUsername.toLowerCase();
    
    try {
      await api.createUser({
        email: `${username}@swopr.local`,
        name: newStaffName,
        role: newStaffRole,
        username: username,
        password: newStaffPassword
      });
      
      toast.success(`Dodano pracownika: ${newStaffName}`);
      setNewStaffUsername('');
      setNewStaffPassword('');
      setNewStaffName('');
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(`Błąd: ${error.message}`);
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleResetStats = async () => {
    if (!window.confirm('CZY NA PEWNO? Ta operacja usunie WSZYSTKIE wypożyczenia i raporty oraz zresetuje status sprzętu. Nie można tego cofnąć.')) {
      return;
    }

    setIsResetting(true);
    try {
      await api.resetStats();
      toast.success('Statystyki zostały zresetowane');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Błąd podczas resetowania statystyk');
    } finally {
      setIsResetting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newAdminPassword.length < 5) {
      toast.error('Hasło musi mieć min. 5 znaków');
      return;
    }
    setIsChangingPassword(true);
    try {
      await api.updateUser(user.uid, {
        password: newAdminPassword
      });
      toast.success('Hasło zostało zmienione. Zaloguj się ponownie.');
      setNewAdminPassword('');
      fetchData();
    } catch (error: any) {
      toast.error(`Błąd: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    showConfirm(
      'Usuń sprzęt',
      'Czy na pewno chcesz usunąć ten sprzęt z bazy danych?',
      async () => {
        await api.deleteEquipment(id);
        toast.success('Sprzęt usunięty');
        fetchData();
      }
    );
  };

  const updateEquipmentRate = async (id: string, hourlyRate: number, halfHourRate: number) => {
    await api.updateEquipment(id, { hourlyRate, halfHourRate });
    toast.success('Zaktualizowano ceny');
    fetchData();
  };

  const handleRepair = async (id: string) => {
    await api.updateEquipment(id, { status: 'available', issueDescription: '' });
    toast.success('Oznaczono jako naprawione');
    fetchData();
  };
  
  const handleCancelRental = async (rental: Rental) => {
    showConfirm(
      'Anuluj wypożyczenie',
      `Czy na pewno chcesz anulować wypożyczenie: ${rental.equipmentName}? Ta operacja nie zostanie wliczona do statystyk.`,
      async () => {
        try {
          await api.updateRental(rental.id, {
            endTime: new Date().toISOString(),
            status: 'cancelled',
            totalAmount: 0
          });
          await api.updateEquipment(rental.equipmentId, { status: 'available' });
          toast.warning('Anulowano wypożyczenie.');
          fetchData();
        } catch (error) {
          toast.error('Błąd podczas anulowania');
        }
      }
    );
  };

  const handleDeleteRental = async (rental: Rental) => {
    showConfirm(
      'Usuń operację',
      `Czy na pewno chcesz usunąć tę operację z historii? Trafi ona do zakładki "Usunięte".`,
      async () => {
        try {
          await api.updateRental(rental.id, {
            status: 'deleted'
          });
          toast.info('Przeniesiono do usuniętych.');
          fetchData();
        } catch (error) {
          toast.error('Błąd podczas usuwania');
        }
      }
    );
  };

  const handleRestoreRental = async (rental: Rental) => {
    showConfirm(
      'Przywróć operację',
      `Czy przywrócić tę operację do historii?`,
      async () => {
        try {
          // Check if it was cancelled or completed originally? 
          // Actually just set back to what it was. But 'deleted' overwrote it.
          // In a real app we might store the previous_status. 
          // For now, if totalAmount > 0 we assume it was completed, else cancelled?
          // Or just set to 'completed' as default restore.
          await api.updateRental(rental.id, {
            status: (rental.totalAmount || 0) > 0 ? 'completed' : 'cancelled'
          });
          toast.success('Przywrócono operację.');
          fetchData();
        } catch (error) {
          toast.error('Błąd podczas przywracania');
        }
      }
    );
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === user.uid) {
      toast.error('Nie możesz usunąć własnego konta');
      return;
    }
    showConfirm(
      'Usuń pracownika',
      'Czy na pewno chcesz usunąć tego pracownika? Ta operacja jest nieodwracalna.',
      async () => {
        try {
          await api.deleteUser(uid);
          toast.success('Pracownik usunięty');
          fetchData();
        } catch (error) {
          toast.error('Błąd podczas usuwania pracownika');
        }
      }
    );
  };

  // Stats calculation
  const totalRevenue = rentals.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
  const cashRevenue = rentals.reduce((acc, r) => r.paymentMethod === 'cash' ? acc + (r.totalAmount || 0) : acc, 0);
  const cardRevenue = rentals.reduce((acc, r) => r.paymentMethod === 'card' ? acc + (r.totalAmount || 0) : acc, 0);

  const paymentData = [
    { name: 'Gotówka', value: cashRevenue },
    { name: 'Karta', value: cardRevenue },
  ];
  const COLORS = ['#3b82f6', '#10b981'];

  const typePopularity = equipment.map(type => ({
    name: type.name,
    count: rentals.filter(r => r.equipmentId === type.id).length
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const brokenEquipment = equipment.filter(e => e.status === 'broken');

  return (
    <div className="space-y-8">
      <Tabs defaultValue="dashboard" className="w-full">
        <div className="sticky top-[65px] z-40 bg-slate-50/95 backdrop-blur-sm -mx-4 px-4 py-2 border-b mb-6">
          <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 rounded-lg w-full gap-1">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Dashboard</TabsTrigger>
            <TabsTrigger value="active" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Wypożyczone</TabsTrigger>
            <TabsTrigger value="equipment" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Sprzęt</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Historia</TabsTrigger>
            <TabsTrigger value="deleted" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Usunięte</TabsTrigger>
            <TabsTrigger value="staff" className="flex-1 min-w-[120px] data-[state=active]:bg-background py-2.5">Pracownicy</TabsTrigger>
            <TabsTrigger value="alerts" className="flex-1 min-w-[120px] relative data-[state=active]:bg-background py-2.5">
              Alerty
              {brokenEquipment.length > 0 && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {brokenEquipment.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-8 pt-2">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm border-none shadow-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Przychód Całkowity</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-slate-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{totalRevenue} PLN</div>
                <p className="text-xs text-slate-400 mt-1">Suma wszystkich rozliczonych</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none shadow-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Gotówka</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{cashRevenue} PLN</div>
                <p className="text-xs text-slate-400 mt-1">Przyjęte w gotówce</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none shadow-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Karta</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{cardRevenue} PLN</div>
                <p className="text-xs text-slate-400 mt-1">Terminale płatnicze</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none shadow-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Aktywne Jednostki</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Anchor className="h-4 w-4 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold tracking-tight">{equipment.filter(e => e.status === 'rented').length} / {equipment.length}</div>
                  <p className="text-xs text-slate-400 mt-1">Jednostki na wodzie</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleResetStats} className="text-[10px] h-7 px-2 text-red-600 border-red-100 hover:bg-red-50 font-bold uppercase transition-all">
                  Resetuj Dane
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Dzisiejszy utarg', val: rentals.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.totalAmount || 0), 0), color: 'blue' },
              { label: 'Gotówka', val: rentals.filter(r => r.status === 'completed' && r.paymentMethod === 'cash').reduce((sum, r) => sum + (r.totalAmount || 0), 0), color: 'green' },
              { label: 'Karta', val: rentals.filter(r => r.status === 'completed' && r.paymentMethod === 'card').reduce((sum, r) => sum + (r.totalAmount || 0), 0), color: 'purple' },
              { label: 'Liczba Slipów', val: rentals.filter(r => r.status === 'completed' && r.equipmentName.toLowerCase().includes('slip')).length, color: 'amber' },
              { label: 'Aktywne jednostki', val: equipment.filter(e => e.status === 'rented').length, color: 'slate' }
            ].map((stat, i) => (
              <Card key={i} className={`border-l-4 border-l-${stat.color}-500 shadow-sm`}>
                <CardHeader className="py-4 px-5">
                  <CardDescription className="text-[10px] uppercase font-black tracking-widest text-slate-500">{stat.label}</CardDescription>
                  <CardTitle className="text-2xl font-black">{stat.val} {stat.label.includes('Liczba') || stat.label.includes('jednostki') ? '' : 'PLN'}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 grid-cols-1 xl:grid-cols-7">
            <Card className="xl:col-span-4 shadow-sm border-none">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Popularność Sprzętu</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] w-full pt-4">
                {typePopularity.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typePopularity} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                    Brak danych do wyświetlenia
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="xl:col-span-3 shadow-sm border-none">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Metody Płatności</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] w-full pt-4 relative">
                {paymentData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="45%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                    Brak danych o płatnościach
                  </div>
                )}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 text-sm font-medium">
                  <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-md bg-blue-500" /> Gotówka</div>
                  <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-md bg-green-500" /> Karta</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-4">
            <Button 
              variant="outline" 
              size="lg" 
              className="text-red-500 border-red-200 hover:bg-red-50 font-bold px-8 shadow-sm"
              onClick={handleResetStats}
              disabled={isResetting}
            >
              {isResetting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCcw className="mr-2 h-5 w-5" />}
              Resetuj Statystyki Całkowite
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Wypożyczone w tym momencie</CardTitle>
              <CardDescription>Lista aktualnie aktywnych wypożyczeń.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Od</TableHead>
                    <TableHead>Sprzęt</TableHead>
                    <TableHead>Planowo</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Płatność</TableHead>
                    <TableHead>Obsługa</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.filter(r => r.status === 'active').map(rental => (
                    <TableRow key={rental.id}>
                      <TableCell>{format(new Date(rental.startTime), 'HH:mm')}</TableCell>
                      <TableCell className="font-bold">{rental.equipmentName}</TableCell>
                      <TableCell>{rental.plannedMinutes} min</TableCell>
                      <TableCell>{rental.customerPhone || '-'}</TableCell>
                      <TableCell>
                         <Badge variant="outline">{rental.paymentMethod === 'cash' ? 'Gotówka' : 'Karta'}</Badge>
                         <span className="ml-2 text-xs font-semibold">{rental.totalAmount} PLN</span>
                      </TableCell>
                      <TableCell className="text-xs">{rental.sellerName}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleCancelRental(rental)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Anuluj
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rentals.filter(r => r.status === 'active').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400 italic">Brak aktywnych wypożyczeń</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Zarządzanie Flotą</CardTitle>
              <CardDescription>Dodawaj nowy sprzęt i edytuj cennik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-wrap gap-4 items-end border-b pb-6">
                <div className="grid gap-2">
                  <Label>Nazwa / Numer</Label>
                  <Input value={newEqName} onChange={e => setNewEqName(e.target.value)} placeholder="np. Kajak 12" />
                </div>
                <div className="grid gap-2">
                  <Label>Typ</Label>
                  <Select value={newEqType} onValueChange={(v: any) => setNewEqType(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Kajak', 'Rower wodny', 'Deska SUP', 'Łódź motorowa', 'Łódź żaglowa', 'Slip', 'Inne'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cena (PLN/h)</Label>
                  <Input type="number" value={newEqRate} onChange={e => setNewEqRate(Number(e.target.value))} className="w-[100px]" />
                </div>
                <div className="grid gap-2">
                  <Label>Cena (PLN/30min)</Label>
                  <Input type="number" value={newEqHalfRate} onChange={e => setNewEqHalfRate(Number(e.target.value))} className="w-[100px]" />
                </div>
                <Button onClick={handleAddEquipment}><Plus className="mr-2 h-4 w-4" /> Dodaj</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Cena/h</TableHead>
                    <TableHead>Cena/30m</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          defaultValue={item.hourlyRate} 
                          className="h-8 w-20"
                          onBlur={(e) => updateEquipmentRate(item.id, Number(e.target.value), (item as any).halfHourRate || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          defaultValue={(item as any).halfHourRate || 0} 
                          className="h-8 w-20"
                          onBlur={(e) => updateEquipmentRate(item.id, item.hourlyRate, Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'available' ? 'outline' : item.status === 'rented' ? 'secondary' : 'destructive'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEquipment(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Historia Wypożyczeń</CardTitle>
                  <CardDescription>Pełna historia operacji.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Sprzęt..." 
                    className="max-w-[150px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Input 
                    placeholder="Pracownik..." 
                    className="max-w-[150px]"
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Sprzęt</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Czas</TableHead>
                    <TableHead>Kwota</TableHead>
                    <TableHead>Metoda</TableHead>
                    <TableHead>Obsługa</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals
                    .filter(r => r.status !== 'active' && r.status !== 'deleted')
                    .filter(r => r.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()))
                    .filter(r => r.sellerName.toLowerCase().includes(employeeFilter.toLowerCase()))
                    .map(rental => (
                    <TableRow key={rental.id} className={rental.status === 'cancelled' ? 'opacity-40 grayscale' : ''}>
                      <TableCell>{format(new Date(rental.startTime), 'dd.MM HH:mm')}</TableCell>
                      <TableCell>{rental.equipmentName}</TableCell>
                      <TableCell>{rental.customerPhone || '-'}</TableCell>
                      <TableCell>
                        {rental.endTime ? differenceInMinutes(new Date(rental.endTime), new Date(rental.startTime)) : '-'} min
                      </TableCell>
                      <TableCell className="font-bold">
                        {rental.status === 'cancelled' ? 'ANULOWANO' : `${rental.totalAmount} PLN`}
                      </TableCell>
                      <TableCell>
                        {rental.status === 'cancelled' ? '-' : <Badge variant="outline">{rental.paymentMethod === 'cash' ? 'Gotówka' : 'Karta'}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{rental.sellerName}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => handleDeleteRental(rental)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted">
          <Card>
            <CardHeader>
              <CardTitle>Usunięte operacje</CardTitle>
              <CardDescription>Operacje usunięte w ciągu ostatnich 48 godzin.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Sprzęt</TableHead>
                    <TableHead>Kwota</TableHead>
                    <TableHead>Obsługa</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals
                    .filter(r => r.status === 'deleted')
                    .filter(r => {
                       // Filter out items older than 48 hours for the UI
                       const deletedDate = r.endTime ? new Date(r.endTime) : new Date(); // Using endTime as a proxy for when it was cancelled/completed
                       const twoDaysAgo = new Date();
                       twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
                       return deletedDate > twoDaysAgo;
                    })
                    .map(rental => (
                    <TableRow key={rental.id}>
                      <TableCell>{format(new Date(rental.startTime), 'dd.MM HH:mm')}</TableCell>
                      <TableCell>{rental.equipmentName}</TableCell>
                      <TableCell>{rental.totalAmount || 0} PLN</TableCell>
                      <TableCell className="text-xs">{rental.sellerName}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRestoreRental(rental)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" /> Przywróć
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rentals.filter(r => r.status === 'deleted').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">Brak usuniętych operacji</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Dodaj Pracownika</CardTitle>
                <CardDescription>Utwórz nowe konto dla sprzedawcy lub admina.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Imię i Nazwisko</Label>
                  <Input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Jan Kowalski" />
                </div>
                <div className="grid gap-2">
                  <Label>Login (Username)</Label>
                  <Input value={newStaffUsername} onChange={e => setNewStaffUsername(e.target.value)} placeholder="jkowalski" />
                </div>
                <div className="grid gap-2">
                  <Label>Hasło</Label>
                  <Input type="password" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="grid gap-2">
                  <Label>Rola</Label>
                  <Select value={newStaffRole} onValueChange={(v: any) => setNewStaffRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Sprzedawca</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddStaff} className="w-full" disabled={isAddingStaff}>
                  {isAddingStaff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Dodaj Pracownika
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zmień Moje Hasło</CardTitle>
                <CardDescription>Zaktualizuj hasło do swojego konta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nowe Hasło</Label>
                  <Input 
                    type="password" 
                    value={newAdminPassword} 
                    onChange={e => setNewAdminPassword(e.target.value)} 
                    placeholder="Min. 6 znaków" 
                  />
                </div>
                <Button onClick={handleChangePassword} variant="secondary" className="w-full" disabled={isChangingPassword}>
                  {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                  Zaktualizuj Hasło
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista Pracowników</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i Nazwisko</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.uid}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{(u as any).username || u.email.split('@')[0]}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteUser(u.uid)}
                          disabled={u.uid === user.uid}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Usuń
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="grid gap-4">
            {brokenEquipment.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle2 className="mb-2 h-12 w-12 text-green-500" />
                <p>Brak zgłoszonych usterek. Wszystko sprawne!</p>
              </div>
            )}
            {brokenEquipment.map(item => (
              <Card key={item.id} className="border-red-200 bg-red-50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-red-700">{item.name}</CardTitle>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-red-600">Opis usterki:</p>
                  <p className="text-sm text-red-800">{item.issueDescription || 'Brak opisu'}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 border-red-200 text-red-700 hover:bg-red-100"
                    onClick={() => handleRepair(item.id)}
                  >
                    Oznacz jako naprawione
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reusable Confirmation Dialog */}
      <Dialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmConfig.title}</DialogTitle>
            <CardDescription className="pt-2">{confirmConfig.description}</CardDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmConfig(prev => ({ ...prev, open: false }))}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={() => {
              confirmConfig.onConfirm();
              setConfirmConfig(prev => ({ ...prev, open: false }));
            }}>
              Potwierdź
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
