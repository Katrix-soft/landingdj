import { Injectable } from '@angular/core';

export interface Booking {
    name: string;
    date: string; // localized string or ISO (DD/MM/YYYY)
    time: string;
    location: string;
    type: string;
}

@Injectable({
    providedIn: 'root'
})
export class AvailabilityService {
    private STORAGE_KEY = 'saavedra_bookings';

    // Initial hardcoded dates (strictly unavailable/full day blocked)
    private baseUnavailableDays: number[] = [];

    constructor() { }

    getBookings(): Booking[] {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    addBooking(booking: Booking) {
        const current = this.getBookings();
        current.push(booking);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    }

    getUnavailableDays(month: number, year: number): number[] {
        return [];
    }

    getPartialOccupancy(month: number, year: number): { [day: number]: string[] } {
        // 1. Start with empty occupancy
        const occupancy: { [day: number]: string[] } = {};

        // 2. Add bookings from localStorage
        const bookings = this.getBookings();
        bookings.forEach(booking => {
            // Robust parsing of "DD/MM/YYYY" or ISO
            const parts = booking.date.split('/');
            if (parts.length === 3) {
                const bDay = parseInt(parts[0], 10);
                const bMonth = parseInt(parts[1], 10) - 1; // 0-indexed
                const bYear = parseInt(parts[2], 10);

                if (bMonth === month && bYear === year) {
                    if (!occupancy[bDay]) {
                        occupancy[bDay] = [];
                    }
                    occupancy[bDay].push(`${booking.time} (${booking.type})`);
                }
            }
        });

        return occupancy;
    }
}
