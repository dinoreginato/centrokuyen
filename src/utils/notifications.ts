import { Atencion } from '@/types/database';
import { format, addDays, addHours, differenceInCalendarDays, isBefore, isAfter } from 'date-fns';

// Types for notifications
export interface Notification {
  id: string;
  type: 'appointment_reminder' | 'payment_due' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

// Notification service for appointment reminders and system notifications
export const notificationService = {
  isNotifiableAppointment: (appointment: Atencion) => {
    return !appointment.es_bloqueo && appointment.estado_cita !== 'cancelada';
  },

  // Check for upcoming appointments and create reminders
  checkAppointmentReminders: (appointments: Atencion[]): Notification[] => {
    const notifications: Notification[] = [];
    const now = new Date();
    
    appointments.forEach(appointment => {
      if (!notificationService.isNotifiableAppointment(appointment)) return;

      const appointmentDate = new Date(appointment.fecha + ' ' + appointment.hora);
      
      // 24-hour reminder
      const reminder24h = addHours(appointmentDate, -24);
      if (isBefore(reminder24h, now) && isAfter(appointmentDate, now)) {
        notifications.push({
          id: `reminder_24h_${appointment.id}`,
          type: 'appointment_reminder',
          title: 'Recordatorio de cita - 24 horas',
          message: `Cita con ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} mañana a las ${appointment.hora}`,
          timestamp: now,
          read: false,
          data: appointment
        });
      }
      
      // 1-hour reminder
      const reminder1h = addHours(appointmentDate, -1);
      if (isBefore(reminder1h, now) && isAfter(appointmentDate, now)) {
        notifications.push({
          id: `reminder_1h_${appointment.id}`,
          type: 'appointment_reminder',
          title: 'Recordatorio de cita - 1 hora',
          message: `Cita con ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} en una hora (${appointment.hora})`,
          timestamp: now,
          read: false,
          data: appointment
        });
      }
      
      // Same day reminder (morning of appointment day)
      const morningReminder = new Date(appointment.fecha + ' 08:00:00');
      if (isBefore(morningReminder, now) && isAfter(appointmentDate, now) && 
          format(now, 'yyyy-MM-dd') === format(appointmentDate, 'yyyy-MM-dd')) {
        notifications.push({
          id: `reminder_today_${appointment.id}`,
          type: 'appointment_reminder',
          title: 'Recordatorio de cita - Hoy',
          message: `Cita con ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} hoy a las ${appointment.hora}`,
          timestamp: now,
          read: false,
          data: appointment
        });
      }
    });
    
    return notifications;
  },

  // Check for unpaid appointments that need payment reminders
  checkPaymentReminders: (appointments: Atencion[]): Notification[] => {
    const notifications: Notification[] = [];
    const now = new Date();
    
    appointments.forEach(appointment => {
      if (notificationService.isNotifiableAppointment(appointment) && !appointment.pagado && appointment.estado_asistencia !== 'no_asistio') {
        const appointmentDate = new Date(appointment.fecha + ' ' + appointment.hora);
        const daysSinceAppointment = differenceInCalendarDays(now, appointmentDate);
        
        if (daysSinceAppointment >= 3) {
          notifications.push({
            id: `payment_3days_${appointment.id}`,
            type: 'payment_due',
            title: 'Pago pendiente - 3 días',
            message: `La atención de ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} del ${format(appointmentDate, 'dd/MM/yyyy')} sigue pendiente de pago.`,
            timestamp: now,
            read: false,
            data: appointment
          });
        }

        // Reminder after 7 days
        if (daysSinceAppointment >= 7) {
          notifications.push({
            id: `payment_7days_${appointment.id}`,
            type: 'payment_due',
            title: 'Pago pendiente - 7 días',
            message: `Pago pendiente por atención a ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} del ${format(appointmentDate, 'dd/MM/yyyy')}`,
            timestamp: now,
            read: false,
            data: appointment
          });
        }
        
        // Reminder after 30 days
        if (daysSinceAppointment >= 30) {
          notifications.push({
            id: `payment_30days_${appointment.id}`,
            type: 'payment_due',
            title: 'Pago pendiente - 30 días',
            message: `Pago vencido por atención a ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'} del ${format(appointmentDate, 'dd/MM/yyyy')}`,
            timestamp: now,
            read: false,
            data: appointment
          });
        }
      }
    });
    
    return notifications;
  },

  // Get all notifications for today
  getTodayNotifications: (appointments: Atencion[]): Notification[] => {
    const appointmentReminders = notificationService.checkAppointmentReminders(appointments);
    const paymentReminders = notificationService.checkPaymentReminders(appointments);
    
    return [...appointmentReminders, ...paymentReminders]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },

  mergeNotifications: (incomingNotifications: Notification[]) => {
    const existingNotifications = notificationService.loadNotifications();
    const notificationMap = new Map<string, Notification>();

    existingNotifications.forEach(notification => {
      notificationMap.set(notification.id, notification);
    });

    incomingNotifications.forEach(notification => {
      const existing = notificationMap.get(notification.id);
      notificationMap.set(notification.id, existing ? {
        ...notification,
        read: existing.read,
        timestamp: existing.timestamp || notification.timestamp
      } : notification);
    });

    return Array.from(notificationMap.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },

  // Simulate browser notification (requires user permission)
  showBrowserNotification: (notification: Notification) => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/medical-icon.png',
            tag: notification.id,
            requireInteraction: true
          });
        }
      });
    }
  },

  // Store notifications in localStorage
  saveNotifications: (notifications: Notification[]) => {
    localStorage.setItem('medical_center_notifications', JSON.stringify(notifications));
  },

  // Load notifications from localStorage
  loadNotifications: (): Notification[] => {
    try {
      const stored = localStorage.getItem('medical_center_notifications');
      if (stored) {
        const notifications = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
    return [];
  },

  // Mark notification as read
  markAsRead: (notificationId: string) => {
    const notifications = notificationService.loadNotifications();
    const updated = notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    notificationService.saveNotifications(updated);
  },

  // Mark all notifications as read
  markAllAsRead: () => {
    const notifications = notificationService.loadNotifications();
    const updated = notifications.map(n => ({ ...n, read: true }));
    notificationService.saveNotifications(updated);
  },

  // Get unread notifications count
  getUnreadCount: (): number => {
    const notifications = notificationService.loadNotifications();
    return notifications.filter(n => !n.read).length;
  },

  // Clear old notifications (older than 30 days)
  clearOldNotifications: () => {
    const notifications = notificationService.loadNotifications();
    const thirtyDaysAgo = addDays(new Date(), -30);
    const filtered = notifications.filter(n => 
      isAfter(n.timestamp, thirtyDaysAgo)
    );
    notificationService.saveNotifications(filtered);
  },

  // Get upcoming appointments for the next few days
  getUpcomingAppointments: (appointments: Atencion[], daysAhead: number = 7): Atencion[] => {
    const now = new Date();
    const futureDate = addDays(now, daysAhead);
    
    return appointments
      .filter(appointment => {
        const appointmentDate = new Date(appointment.fecha + ' ' + appointment.hora);
        return isAfter(appointmentDate, now) && isBefore(appointmentDate, futureDate);
      })
      .sort((a, b) => new Date(a.fecha + ' ' + a.hora).getTime() - new Date(b.fecha + ' ' + b.hora).getTime());
  }
};

// Auto-notification service that runs periodically
export const autoNotificationService = {
  intervalId: null as number | null,

  start: (appointments: Atencion[]) => {
    // Clear existing interval
    if (autoNotificationService.intervalId) {
      clearInterval(autoNotificationService.intervalId);
    }

    // Run immediately
    autoNotificationService.checkAndNotify(appointments);

    // Set up interval to check every 30 minutes
    autoNotificationService.intervalId = window.setInterval(() => {
      autoNotificationService.checkAndNotify(appointments);
    }, 30 * 60 * 1000); // 30 minutes
  },

  stop: () => {
    if (autoNotificationService.intervalId) {
      clearInterval(autoNotificationService.intervalId);
      autoNotificationService.intervalId = null;
    }
  },

  checkAndNotify: (appointments: Atencion[]) => {
    const notifications = notificationService.getTodayNotifications(appointments);
    const existingNotifications = notificationService.loadNotifications();
    
    // Show browser notifications for new unread notifications
    notifications.forEach(notification => {
      const exists = existingNotifications.some(n => n.id === notification.id);
      
      if (!exists) {
        notificationService.showBrowserNotification(notification);
      }
    });
    
    // Save notifications preserving read state and previous history
    notificationService.saveNotifications(notificationService.mergeNotifications(notifications));
    
    // Clear old notifications
    notificationService.clearOldNotifications();
  }
};

export default notificationService;
