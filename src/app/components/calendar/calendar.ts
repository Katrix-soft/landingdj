import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import emailjs from '@emailjs/browser';
import { AvailabilityService, Booking } from '../../services/availability.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit {
  currentDate: Date = new Date();
  selectedDate: Date | null = null;
  days: number[] = [];
  emptyDays: number[] = [];
  monthName: string = '';
  contactForm: FormGroup;
  isSending = false;
  showSuccess = false;
  isCustomTime = false;
  
  private readonly SLOT_DURATION = 120; // 2 hours
  private readonly DAY_MINUTES = 1440;

  unavailableDates: number[] = [];
  partiallyAvailableDates: number[] = [];
  partialOccupancy: { [day: number]: string[] } = {};
  dayMetrics: { [day: number]: { bg: string, border: string } } = {};

  selectedDateAvailableSlots: string[] | null = null;

  constructor(
    private fb: FormBuilder,
    private availabilityService: AvailabilityService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      eventType: ['boda', [Validators.required]],
      packs: [[]],
      eventTime: ['', [Validators.required]],
      location: ['', [Validators.required]],
      message: ['', [Validators.required]],
      selectedDate: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.renderCalendar();
  }

  renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    this.monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(this.currentDate);

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

    this.emptyDays = Array(firstDayOfMonth).fill(0);
    this.days = Array.from({ length: lastDateOfMonth }, (_, i) => i + 1);

    // Fetch from service
    this.unavailableDates = this.availabilityService.getUnavailableDays(month, year);
    this.partialOccupancy = this.availabilityService.getPartialOccupancy(month, year);
    this.partiallyAvailableDates = Object.keys(this.partialOccupancy).map(Number);

    // Pre-calculate metrics for performance
    this.calculateAllDayMetrics();
  }

  private calculateAllDayMetrics() {
    this.dayMetrics = {};
    this.days.forEach(day => {
      const ratio = this.getOccupancyRatio(day);

      // Default styles for "Free" (Greens)
      let bg = 'rgba(16, 185, 129, 0.2)';
      let border = 'rgba(16, 185, 129, 0.5)';

      if (this.isUnavailable(day)) {
        this.dayMetrics[day] = { bg: '', border: '' };
        return;
      }

      if (ratio > 0) {
        if (ratio < 0.3) {
          bg = 'rgba(16, 185, 129, 0.2)';
          border = 'rgba(16, 185, 129, 0.5)';
        } else if (ratio < 0.6) {
          bg = 'rgba(245, 158, 11, 0.3)';
          border = 'rgba(245, 158, 11, 0.6)';
        } else {
          bg = 'rgba(239, 68, 68, 0.4)';
          border = 'rgba(239, 68, 68, 0.7)';
        }
      }

      this.dayMetrics[day] = { bg, border };
    });
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderCalendar();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderCalendar();
  }

  selectDate(day: number) {
    if (this.isUnavailable(day)) return;

    this.selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);

    // Calculate available slots for the selected day
    this.calculateAvailableSlots(day);

    // Use a fixed format DD/MM/YYYY to avoid locale issues
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = (this.currentDate.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = this.currentDate.getFullYear();
    const formattedDate = `${dayStr}/${monthStr}/${yearStr}`;

    this.contactForm.patchValue({
      selectedDate: formattedDate
    });

    // Refresh metrics to show selection if needed (though metrics are for occupancy)
    this.calculateAllDayMetrics();
  }

  calculateAvailableSlots(day: number) {
    const merged = this.getMergedOccupiedIntervals(day);

    // 3. Find Free Gaps
    const freeSlots: { start: number, end: number }[] = [];
    let cursor = 0; // Start of day 00:00

    merged.forEach(interval => {
      if (interval.start > cursor) {
        freeSlots.push({ start: cursor, end: interval.start });
      }
      cursor = Math.max(cursor, interval.end);
    });

    if (cursor < 1440) {
      freeSlots.push({ start: cursor, end: 1440 });
    }

    // Initial check for minimum 2 hours
    const validSlots = freeSlots.filter(slot => (slot.end - slot.start) >= this.SLOT_DURATION);

    // 4. Generate Discrete Slots (2-hour blocks)
    const discreteSlots: string[] = [];
    validSlots.forEach(slot => {
      let currentStart = slot.start;
      const slotDuration = 120; // 2 hours in minutes

      while (currentStart + slotDuration <= slot.end) {
        const currentEnd = currentStart + slotDuration;
        discreteSlots.push(
          `${this.minutesToTime(currentStart)} a ${this.minutesToTime(currentEnd)}`
        );
        currentStart += slotDuration;
      }
    });

    this.selectedDateAvailableSlots = discreteSlots;
    if (this.selectedDateAvailableSlots.length === 0 && this.partialOccupancy[day]) {
      this.selectedDateAvailableSlots = [];
    }
  }

  private getMergedOccupiedIntervals(day: number): { start: number, end: number }[] {
    const occupiedStrings = this.partialOccupancy[day] || [];
    const occupiedIntervals: { start: number, end: number }[] = [];

    occupiedStrings.forEach(occ => {
      const times = occ.match(/(\d{1,2}:\d{2})/g);
      if (times && times.length >= 2) {
        const start = this.timeToMinutes(times[0]);
        let end = this.timeToMinutes(times[1]);
        if (end < start) {
          end = 1440;
        }
        occupiedIntervals.push({ start, end });
      }
    });

    occupiedIntervals.sort((a, b) => a.start - b.start);
    const merged: { start: number, end: number }[] = [];
    if (occupiedIntervals.length > 0) {
      let current = occupiedIntervals[0];
      for (let i = 1; i < occupiedIntervals.length; i++) {
        const next = occupiedIntervals[i];
        if (current.end >= next.start) {
          current.end = Math.max(current.end, next.end);
        } else {
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
    }
    return merged;
  }

  getOccupancyRatio(day: number): number {
    const merged = this.getMergedOccupiedIntervals(day);
    const occupiedMinutes = merged.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
    return occupiedMinutes / this.DAY_MINUTES;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 24 && m === 0) return '23:59';
    if (h >= 24) return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  isToday(day: number): boolean {
    const today = new Date();
    return today.getDate() === day &&
      today.getMonth() === this.currentDate.getMonth() &&
      today.getFullYear() === this.currentDate.getFullYear();
  }

  isSelected(day: number): boolean {
    return this.selectedDate?.getDate() === day &&
      this.selectedDate?.getMonth() === this.currentDate.getMonth() &&
      this.selectedDate?.getFullYear() === this.currentDate.getFullYear();
  }

  isUnavailable(day: number): boolean {
    return this.unavailableDates.includes(day);
  }

  isPartiallyAvailable(day: number): boolean {
    return this.partiallyAvailableDates.includes(day);
  }

  selectTimeSlot(slot: string) {
    if (slot === 'custom') {
      this.isCustomTime = true;
      this.contactForm.patchValue({ eventTime: '' });
    } else {
      this.isCustomTime = false;
      this.contactForm.patchValue({ eventTime: slot });
    }
  }

  availablePacks = [
    { id: 'all', name: 'TODO (PACK COMPLETO)', icon: 'auto_awesome' },
    { id: 'sonido', name: 'Sonido Profesional', icon: 'volume_up' },
    { id: 'iluminacion', name: 'Iluminación DJ', icon: 'lightbulb' },
    { id: 'pantalla', name: 'Pantalla LED / TV', icon: 'screenshot_monitor' },
    { id: 'fx', name: 'Efectos Especiales', icon: 'celebration' },
    { id: 'fotos', name: 'Foto y Video', icon: 'photo_camera' }
  ];

  togglePack(packId: string) {
    let currentPacks = [...(this.contactForm.get('packs')?.value as string[])];

    if (packId === 'all') {
      const allIds = this.availablePacks.filter(p => p.id !== 'all').map(p => p.id);
      const isAllSelected = allIds.every(id => currentPacks.includes(id));

      if (isAllSelected) {
        currentPacks = [];
      } else {
        currentPacks = [...allIds];
      }
    } else {
      const index = currentPacks.indexOf(packId);
      if (index > -1) {
        currentPacks.splice(index, 1);
      } else {
        currentPacks.push(packId);
      }
    }
    this.contactForm.patchValue({ packs: currentPacks });
  }

  isPackSelected(packId: string): boolean {
    const currentPacks = this.contactForm.get('packs')?.value as string[] || [];
    if (packId === 'all') {
      const allIds = this.availablePacks.filter(p => p.id !== 'all').map(p => p.id);
      return allIds.length > 0 && allIds.every(id => currentPacks.includes(id));
    }
    return currentPacks.includes(packId);
  }

  async onSubmit() {
    if (this.contactForm.valid) {
      this.isSending = true;
      const { name, email, phone, eventType, eventTime, location, message, selectedDate, packs } = this.contactForm.value;
      const packsTranslated = packs.map((p: string) => this.availablePacks.find(ap => ap.id === p)?.name).join(', ');

      try {
        const templateParams = {
          from_name: name,
          from_email: email,
          phone: phone,
          event_type: eventType,
          event_time: eventTime,
          location: location,
          selected_date: selectedDate,
          packs: packsTranslated || 'Ninguno',
          message: message,
          to_name: 'Saavedra Producciones'
        };

        const SERVICE_ID = 'service_hkxauww';
        const TEMPLATE_ID = 'template_smpf3uc';
        const PUBLIC_KEY = 'vGBVyxeKhbM-SbxCC';

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

        const CALLMEBOT_API_KEY = '4034379';
        const djPhone = '5492616557673';

        const cleanClientPhone = phone.replace(/\D/g, '');
        const responseTemplate = encodeURIComponent(`Hola ${name}! Soy DJ-MECHA de Saavedra Producciones 🎧. Recibí tu consulta por el evento del día ${selectedDate} en ${location}. ¿Cómo estás? Me gustaría contarte más sobre nuestro servicio.`);
        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        const whatsappReplyLink = `https://wa.me/${cleanClientPhone}?text=${responseTemplate}`;

        const plainText = `*📻 NUEVA CONSULTA*
━━━━━━━━━━━━━━━━━━
👤 *Nombre:* ${name}
📅 *Fecha:* ${selectedDate}
⏰ *Hora:* ${eventTime}
📍 *Lugar:* ${location}
🗺️ *Ver Mapa:* ${googleMapsLink}
🎉 *Evento:* ${eventType.toUpperCase()}
📦 *Packs:* ${packsTranslated || 'Sin packs seleccionados'}
📱 *Tel:* ${phone}
✉️ *Email:* ${email}
━━━━━━━━━━━━━━━━━━
💬 *Mensaje:* ${message}

👉 *RESPONDER AL CLIENTE:*
${whatsappReplyLink}`;
        const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${djPhone}&text=${encodeURIComponent(plainText)}&apikey=${CALLMEBOT_API_KEY}`;

        fetch(callmebotUrl, { mode: 'no-cors' }).catch(err => console.log('CallMeBot Error:', err));

        const newBooking: Booking = {
          name,
          date: selectedDate,
          time: eventTime,
          location,
          type: eventType
        };
        this.availabilityService.addBooking(newBooking);

        this.contactForm.reset({ eventType: 'boda' });
        this.selectedDate = null;
        this.selectedDateAvailableSlots = null;
        this.renderCalendar();

        this.showSuccess = true;

      } catch (error) {
        console.error('Error al enviar:', error);
        alert('Hubo un problema al enviar la consulta. Por favor, intenta más tarde.');
      } finally {
        this.isSending = false;
      }

    } else {
      alert('Por favor, completa todos los campos y selecciona una fecha en el calendario.');
    }
  }
}
