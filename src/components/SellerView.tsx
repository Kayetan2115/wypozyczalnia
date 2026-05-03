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
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  const [customerPhone, setCustomerPhone] = useState('');
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [rateType, setRateType] = useState<'30min' | '1h'>('1h');
  const [activeRentalToStop, setActiveRentalToStop] = useState<Rental | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [issueDescription, setIssueDescription] = useState('');

  const calculatePrice = (equipment: Equipment | null, minutes: number, type: '30min' | '1h') => {
    if (!equipment) return 0;
    const rate = type === '30min' ? equipment.halfHourRate : equipment.hourlyRate;
    const units = type === '30min' ? minutes / 30 : minutes / 60;
    return rate * units;
  };

  const handleStartRental = async () => {
    if (!selectedEquipment || isStarting) return;
    
    // Check if equipment is still available (re-fetch to be sure)
    const freshEq = equipment.find(e => e.id === selectedEquipment.id);
    if (freshEq?.status === 'rented') {
      toast.error('Ten sprzęt został właśnie wypożyczony przez kogoś innego.');
      fetchData();
      return;
    }

    try {
      setIsStarting(true);
      const rateUsed = rateType === '30min' ? selectedEquipment.halfHourRate : selectedEquipment.hourlyRate;
      const totalAmount = calculatePrice(selectedEquipment, plannedMinutes, rateType);

      const rentalData = {
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        startTime: new Date().toISOString(),
        deposit: false,
        customerPhone,
        plannedMinutes,
        rateUsed,
        rateType,
        totalAmount,
        paymentMethod,
        sellerId: user.uid,
        sellerName: user.name,
        status: 'active'
      };

      await api.createRental(rentalData);
      await api.updateEquipment(selectedEquipment.id, { status: 'rented' });
      toast.success(`Wypożyczono: ${selectedEquipment.name} (${totalAmount} PLN)`);
      setIsStartDialogOpen(false);
      setCustomerPhone('');
      setPlannedMinutes(60);
      setRateType('1h');
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas rozpoczynania wypożyczenia');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopRental = async () => {
    if (!activeRentalToStop) return;
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(activeRentalToStop.startTime);
      const actualMinutes = differenceInMinutes(new Date(endTime), startTime);
      const plannedMinutes = activeRentalToStop.plannedMinutes;
      
      // 5-minute grace period
      const overtimeMinutes = Math.max(0, actualMinutes - plannedMinutes - 5);
      
      let finalTotal = activeRentalToStop.totalAmount || 0;
      
      if (overtimeMinutes > 0) {
        // Calculate overtime in 30-min increments
        const eq = equipment.find(e => e.id === activeRentalToStop.equipmentId);
        const overtimeRate = eq?.halfHourRate || activeRentalToStop.rateUsed / (activeRentalToStop.rateType === '1h' ? 2 : 1);
        
        const extraUnits = Math.ceil(overtimeMinutes / 30);
        const extraCharge = extraUnits * overtimeRate;
        finalTotal += extraCharge;
        toast.info(`Naliczono nadgodziny: +${extraCharge} PLN`);
      }

      // Update rental
      await api.updateRental(activeRentalToStop.id, {
        endTime,
        totalAmount: finalTotal,
        overtimeMinutes,
        status: 'completed'
      });
      
      // Update equipment status and issue if reported
      const eq = equipment.find(e => e.id === activeRentalToStop.equipmentId);
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
      
      toast.success(`Zakończono: ${activeRentalToStop.equipmentName}. Suma: ${finalTotal} PLN`);
      setIsStopDialogOpen(false);
      
      // Reset state
      setActiveRentalToStop(null);
      setIssueDescription('');
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas kończenia wypożyczenia');
    }
  };

  const handleCancelRental = async () => {
    if (!activeRentalToStop) return;
    try {
      await api.updateRental(activeRentalToStop.id, {
        endTime: new Date().toISOString(),
        status: 'cancelled',
        totalAmount: 0
      });
      await api.updateEquipment(activeRentalToStop.equipmentId, { status: 'available' });
      toast.warning('Anulowano wypożyczenie.');
      setIsCancelDialogOpen(false);
      setIsStopDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Błąd podczas anulowania');
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
                      Od: {format(new Date(rental.startTime), 'HH:mm')} ({rental.plannedMinutes} min)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{rental.totalAmount} PLN</p>
                    <Badge variant="outline" className="text-[10px] uppercase">{rental.paymentMethod}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    {rental.customerPhone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-600">
                        <Phone className="h-2.5 w-2.5" /> {rental.customerPhone}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      Tempo: {rental.rateType === '30min' ? '30m' : '1h'}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-8 px-3"
                    onClick={() => {
                      setActiveRentalToStop(rental);
                      setIsStopDialogOpen(true);
                    }}
                  >
                    <Square className="mr-1 h-3 w-3" /> STOP
                  </Button>
                </div>
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
              {['Kajak', 'Rower wodny', 'Deska SUP', 'Łódź motorowa', 'Łódź żaglowa', 'Slip', 'Inne'].map((cat) => (
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
            <div className="grid gap-3">
              <Label>Wybierz czas i stawkę</Label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant={rateType === '30min' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRateType('30min');
                    setPlannedMinutes(30);
                  }}
                  className="flex-1"
                >
                  30 min ({selectedEquipment?.halfHourRate} zł)
                </Button>
                <Button 
                  type="button"
                  variant={rateType === '1h' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRateType('1h');
                    setPlannedMinutes(60);
                  }}
                  className="flex-1"
                >
                  1 godz. ({selectedEquipment?.hourlyRate} zł)
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[30, 60, 90, 120, 150, 180, 240, 300].map(mins => (
                  <Button
                    key={mins}
                    type="button"
                    variant={plannedMinutes === mins ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-xs font-mono"
                    onClick={() => {
                      setPlannedMinutes(mins);
                      // Auto switch rate type based on logic or keep current?
                      // If user selects 30 or 90 and current is 1h, maybe stay or switch?
                      // Let's keep it manual or simple:
                      if (mins % 60 !== 0) setRateType('30min');
                    }}
                  >
                    {mins >= 60 ? `${mins/60}h` : `${mins}m`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Do zapłaty z góry</p>
                <p className="text-2xl font-black text-blue-600">
                  {calculatePrice(selectedEquipment, plannedMinutes, rateType)} PLN
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Stawka</p>
                <p className="text-sm font-semibold">{rateType === '30min' ? '30 min' : '1 godz'}</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Metoda płatności (z góry)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-12 flex-col gap-1"
                >
                  <Wallet className="h-4 w-4" /> Gotówka
                </Button>
                <Button 
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-12 flex-col gap-1"
                >
                  <CreditCard className="h-4 w-4" /> Karta
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Numer telefonu klienta</Label>
              <Input 
                id="phone" 
                placeholder="np. 123456789" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleStartRental} disabled={isStarting} className="w-full py-6 text-lg font-bold">
              {isStarting ? "PROWADZĘ WPIS..." : "PRZYJMIJ WPŁATĘ I START"}
            </Button>
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
                <p className="text-3xl font-black text-slate-900">
                  {activeRentalToStop && differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime))} min
                </p>
              </div>
              {activeRentalToStop && (
                <div className="flex justify-center gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase font-bold">Opłacono</p>
                    <p className="font-semibold">{activeRentalToStop.plannedMinutes} min</p>
                    <p className="text-xs text-blue-600 font-bold">{activeRentalToStop.totalAmount} PLN</p>
                  </div>
                  {differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime)) > activeRentalToStop.plannedMinutes + 5 && (
                    <div className="border-l pl-4">
                      <p className="text-red-500 text-[10px] uppercase font-bold">Nadgodziny</p>
                      <p className="font-semibold text-red-600">
                        {differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime)) - activeRentalToStop.plannedMinutes} min
                      </p>
                      <p className="text-xs text-red-600 font-bold">
                        +{Math.ceil((differenceInMinutes(new Date(), new Date(activeRentalToStop.startTime)) - activeRentalToStop.plannedMinutes - 5) / 30) * (equipment.find(e => e.id === activeRentalToStop.equipmentId)?.halfHourRate || activeRentalToStop.rateUsed / (activeRentalToStop.rateType === '1h' ? 2 : 1))} PLN
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <p className="text-sm font-medium text-center text-slate-600">
                Płatność została uregulowana z góry ({activeRentalToStop?.paymentMethod === 'cash' ? 'Gotówka' : 'Karta'}).
                {differenceInMinutes(new Date(), new Date(activeRentalToStop?.startTime || '')) > (activeRentalToStop?.plannedMinutes || 0) + 5 && 
                  " Pobierz dopłatę za nadgodziny tą samą metodą."}
              </p>
            </div>

            <div className="border-t pt-4 mt-2 grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Anuluj (Błąd)
              </Button>
              <Button onClick={handleStopRental} className="w-full bg-slate-900">ZAKOŃCZ</Button>
            </div>

            <div className="border-t pt-4 mt-2">
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

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anulować wypożyczenie?</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-sm text-slate-600">
              Uwaga: Anulowanie spowoduje, że wypożyczenie nie będzie wliczone do utargu ani historii statystyk. Używaj tylko w przypadku pomyłek.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>Wróć</Button>
            <Button variant="destructive" onClick={handleCancelRental}>POTWIERDŹ ANULOWANIE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
