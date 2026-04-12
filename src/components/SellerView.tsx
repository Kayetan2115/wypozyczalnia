import { useState, useEffect } from 'react';
import { Equipment, Rental, UserProfile, EquipmentStatus, EquipmentType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Play, Square, AlertTriangle, Clock, Phone, Wallet, CreditCard, CheckCircle2, Anchor } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { api } from '../lib/api';

export default function SellerView({ user }: { user: UserProfile }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeRentals, setActiveRentals] = useState<Rental[]>([]);
  
  const fetchData = async () => {
    try {
      const [eqData, rentalData] = await Promise.all([
        api.getEquipment(),
        api.getRentals()
      ]);
      setEquipment(eqData.map((e: any) => ({ ...e, id: e._id })));
      setActiveRentals(rentalData
        .filter((r: any) => r.status === 'active')
        .map((r: any) => ({ ...r, id: r._id }))
      );
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<EquipmentType | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  
  const [customerPhone, setCustomerPhone] = useState('');
  const [plannedDuration, setPlannedDuration] = useState(1);
  const [hasDeposit, setHasDeposit] = useState(false);
  const [activeRentalToStop, setActiveRentalToStop] = useState<Rental | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [issueDescription, setIssueDescription] = useState('');

  const handleStartRental = async () => {
    if (!selectedEquipment) return;
    try {
      const rentalData = {
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        startTime: new Date().toISOString(),
        deposit: hasDeposit,
        customerPhone,
        plannedDuration,
        sellerId: user.uid,
        sellerName: user.name,
        status: 'active'
      };
      await api.createRental(rentalData);
      await api.updateEquipment(selectedEquipment.id, { status: 'rented' });
      toast.success(`Wypożyczono: ${selectedEquipment.name}`);
      setIsStartDialogOpen(false);
      setCustomerPhone('');
      setPlannedDuration(1);
      setHasDeposit(false);
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas rozpoczynania wypożyczenia');
    }
  };

  const handleStopRental = async () => {
    if (!activeRentalToStop) return;
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(activeRentalToStop.startTime);
      const minutes = differenceInMinutes(new Date(endTime), startTime);
      const plannedMinutes = activeRentalToStop.plannedDuration * 60;
      const overtimeMinutes = Math.max(0, minutes - plannedMinutes);
      
      const eq = equipment.find(e => e.id === activeRentalToStop.equipmentId);
      const hourlyRate = eq?.hourlyRate || 0;
      
      const totalAmount = Math.max(hourlyRate * activeRentalToStop.plannedDuration, Math.ceil(minutes / 60 * hourlyRate));

      // Update rental
      await api.updateRental(activeRentalToStop.id, {
        endTime,
        totalAmount,
        overtimeMinutes,
        paymentMethod,
        status: 'completed'
      });
      
      // Update equipment status and issue if reported
      if (eq) {
        const isBroken = issueDescription.trim().length > 0;
        await api.updateEquipment(eq.id, { 
          status: isBroken ? 'broken' : 'available',
          issueDescription: isBroken ? issueDescription : ''
        });
        
        if (isBroken) {
          toast.warning(`Zgłoszono usterkę dla: ${eq.name}`);
        }
      }
      
      toast.success(`Zakończono: ${activeRentalToStop.equipmentName}. Kwota: ${totalAmount} PLN`);
      setIsStopDialogOpen(false);
      
      // Reset state
      setActiveRentalToStop(null);
      setIssueDescription('');
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas kończenia wypożyczenia');
    }
  };

  const handleReportIssue = async () => {
    if (!selectedEquipment) return;
    try {
      await api.updateEquipment(selectedEquipment.id, {
        status: 'broken',
        issueDescription
      });
      toast.warning(`Zgłoszono usterkę: ${selectedEquipment.name}`);
      setIsIssueDialogOpen(false);
      setIssueDescription('');
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas zgłaszania usterki');
    }
  };

  const handleCloseShift = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allRentals = await api.getRentals();
      const todayRentals = allRentals
        .filter((r: any) => r.status === 'completed' && r.endTime?.startsWith(today));

      const cashTotal = todayRentals.reduce((acc: number, r: any) => r.paymentMethod === 'cash' ? acc + (r.totalAmount || 0) : acc, 0);
      const cardTotal = todayRentals.reduce((acc: number, r: any) => r.paymentMethod === 'card' ? acc + (r.totalAmount || 0) : acc, 0);

      await api.createReport({
        sellerId: user.uid,
        sellerName: user.name,
        date: new Date().toISOString(),
        cashTotal,
        cardTotal,
        notes: 'Zamknięcie zmiany'
      });
      toast.success('Zmiana zamknięta pomyślnie');
      setIsShiftDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas zamykania zmiany');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Active Rentals Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Clock className="h-5 w-5 text-blue-600" />
          Aktywne Wypożyczenia ({activeRentals.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeRentals.map(rental => (
            <Card key={rental.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{rental.equipmentName}</h3>
                    <p className="text-xs text-slate-500">
                      Od: {format(new Date(rental.startTime), 'HH:mm')}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => {
                      setActiveRentalToStop(rental);
                      setIsStopDialogOpen(true);
                    }}
                  >
                    <Square className="mr-1 h-3 w-3" /> STOP
                  </Button>
                </div>
                {rental.customerPhone && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                    <Phone className="h-3 w-3" /> {rental.customerPhone}
                  </div>
                )}
                {rental.deposit && (
                  <Badge variant="outline" className="mt-2 bg-amber-50 text-amber-700 border-amber-200">
                    Kaucja
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
          {activeRentals.length === 0 && (
            <p className="col-span-full py-8 text-center text-slate-400 italic">Brak aktywnych wypożyczeń</p>
          )}
        </div>
      </section>

      {/* Equipment Selection */}
      <section>
        {!selectedCategory ? (
          <>
            <h2 className="mb-4 text-lg font-bold">Wybierz kategorię sprzętu</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
              {['Kajak', 'Rower wodny', 'Deska SUP', 'Fleatcher', 'Perkoz', 'Alfa'].map((cat) => (
                <Card 
                  key={cat}
                  className="cursor-pointer hover:bg-slate-50 transition-colors border-2 hover:border-blue-500 active:scale-95"
                  onClick={() => setSelectedCategory(cat as any)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6">
                    <div className="mb-2 sm:mb-3 rounded-full bg-blue-50 p-3 sm:p-4">
                      <Anchor className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                    </div>
                    <span className="font-bold text-sm sm:text-lg text-center">{cat}</span>
                    <span className="text-[10px] sm:text-xs text-slate-500 mt-1">
                      {equipment.filter(e => e.type === cat && e.status === 'available').length} dostępne
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
                  &larr; Powrót
                </Button>
                <h2 className="text-lg font-bold">Dostępne: {selectedCategory}</h2>
              </div>
              <Badge variant="outline" className="bg-blue-50">
                {equipment.filter(e => e.type === selectedCategory && e.status === 'available').length} sztuk
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {equipment
                .filter(item => item.type === selectedCategory)
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                .map(item => (
                <Card 
                  key={item.id} 
                  className={`relative cursor-pointer transition-all hover:scale-[1.05] active:scale-95 ${
                    item.status === 'rented' ? 'opacity-40 grayscale' : 
                    item.status === 'broken' ? 'border-red-200 bg-red-50' : 'border-2 hover:border-green-500'
                  }`}
                  onClick={() => {
                    if (item.status === 'available') {
                      setSelectedEquipment(item);
                      setIsStartDialogOpen(true);
                    } else if (item.status === 'broken') {
                      toast.error(`Sprzęt uszkodzony: ${item.issueDescription}`);
                    }
                  }}
                >
                  <CardContent className="flex flex-col items-center justify-center p-3 text-center">
                    <span className="text-xl font-black text-slate-800">{item.name.replace(/^\D+/g, '') || item.name}</span>
                    <div className="mt-1">
                      {item.status === 'available' && <div className="h-2 w-2 rounded-full bg-green-500" />}
                      {item.status === 'rented' && <div className="h-2 w-2 rounded-full bg-slate-400" />}
                      {item.status === 'broken' && <div className="h-2 w-2 rounded-full bg-red-500" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {equipment.filter(item => item.type === selectedCategory).length === 0 && (
              <div className="py-12 text-center text-slate-400 italic border-2 border-dashed rounded-lg">
                Brak sprzętu w tej kategorii
              </div>
            )}
          </>
        )}
      </section>

      {/* Start Rental Dialog */}
      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rozpocznij: {selectedEquipment?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="duration">Czas wypożyczenia (godziny)</Label>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setPlannedDuration(Math.max(1, plannedDuration - 1))}
                >
                  -
                </Button>
                <span className="text-xl font-bold w-12 text-center">{plannedDuration}h</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setPlannedDuration(plannedDuration + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Numer telefonu (opcjonalnie)</Label>
              <Input 
                id="phone" 
                placeholder="np. 123456789" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="deposit">Kaucja pobrana?</Label>
              <Switch 
                id="deposit" 
                checked={hasDeposit}
                onCheckedChange={setHasDeposit}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleStartRental} className="w-full py-6 text-lg">START</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Rental Dialog */}
      <Dialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Zakończ: {activeRentalToStop?.equipmentName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-center space-y-2">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Czas trwania</p>
                <p className="text-2xl font-bold">
                  {activeRentalToStop && differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime))} min
                </p>
              </div>
              {activeRentalToStop && (
                <div className="flex justify-center gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Planowo</p>
                    <p className="font-semibold">{activeRentalToStop.plannedDuration}h</p>
                  </div>
                  {differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime)) > activeRentalToStop.plannedDuration * 60 && (
                    <div>
                      <p className="text-red-500 font-bold">Nadgodziny</p>
                      <p className="font-semibold text-red-600">
                        {differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime)) - activeRentalToStop.plannedDuration * 60} min
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Metoda płatności</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-16 flex-col gap-1"
                >
                  <Wallet className="h-5 w-5" /> Gotówka
                </Button>
                <Button 
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-16 flex-col gap-1"
                >
                  <CreditCard className="h-5 w-5" /> Karta
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <div className="grid gap-2">
                <Label htmlFor="stop-issue" className="text-red-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Czy wystąpiła usterka?
                </Label>
                <Input 
                  id="stop-issue" 
                  placeholder="Opisz usterkę (zostaw puste jeśli OK)" 
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="border-red-100 focus-visible:ring-red-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleStopRental} className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700">
              ZAKOŃCZ I ROZLICZ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Dialog / Check-in */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontrola po zwrocie: {selectedEquipment?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="issue">Czy wystąpiły jakieś usterki?</Label>
              <Input 
                id="issue" 
                placeholder="Opisz usterkę lub zostaw puste jeśli wszystko OK" 
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsIssueDialogOpen(false);
                setIssueDescription('');
              }} 
              className="w-full"
            >
              WSZYSTKO OK
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReportIssue} 
              className="w-full"
              disabled={!issueDescription.trim()}
            >
              ZGŁOŚ AWARIĘ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Closure Button */}
      <div className="fixed bottom-4 left-4 right-4">
        <Button 
          variant="secondary" 
          className="w-full h-12 shadow-lg border border-slate-200 bg-white"
          onClick={() => setIsShiftDialogOpen(true)}
        >
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" /> Zamknij Zmianę
        </Button>
      </div>

      <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zamknięcie Zmiany</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Czy na pewno chcesz zamknąć zmianę i wygenerować raport finansowy za dzisiaj?
          </p>
          <DialogFooter>
            <Button onClick={handleCloseShift} className="w-full">POTWIERDŹ ZAMKNIĘCIE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
