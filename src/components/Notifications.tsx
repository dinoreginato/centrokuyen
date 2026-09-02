import { useState, useEffect } from 'react'
import { Bell, X, Clock, DollarSign, Info, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Notification, notificationService } from '@/utils/notifications'
import { Atencion } from '@/types/database'

interface NotificationsProps {
  appointments: Atencion[];
}

const Notifications = ({ appointments }: NotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    
    // Set up interval to check for new notifications every minute
    const interval = setInterval(() => {
      checkForNewNotifications()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [appointments])

  const loadNotifications = () => {
    const loadedNotifications = notificationService.loadNotifications()
    setNotifications(loadedNotifications)
    setUnreadCount(notificationService.getUnreadCount())
  }

  const checkForNewNotifications = () => {
    const newNotifications = notificationService.getTodayNotifications(appointments)
    const existingNotifications = notificationService.loadNotifications()
    
    // Check if there are new notifications
    const hasNewNotifications = newNotifications.some(newNotif => 
      !existingNotifications.some(existingNotif => existingNotif.id === newNotif.id)
    )
    
    if (hasNewNotifications) {
      notificationService.saveNotifications(newNotifications)
      loadNotifications()
      
      // Show toast for new notifications
      const newUnreadCount = newNotifications.filter(n => !n.read).length
      if (newUnreadCount > 0) {
        toast.info(`Tienes ${newUnreadCount} nueva${newUnreadCount > 1 ? 's' : ''} notificación${newUnreadCount > 1 ? 'es' : ''}`)
      }
    }
  }

  const markAsRead = (notificationId: string) => {
    notificationService.markAsRead(notificationId)
    loadNotifications()
  }

  const markAllAsRead = () => {
    notificationService.markAllAsRead()
    loadNotifications()
    toast.success('Todas las notificaciones marcadas como leídas')
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'appointment_reminder':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'payment_due':
        return <DollarSign className="h-4 w-4 text-orange-500" />
      case 'system':
        return <Info className="h-4 w-4 text-gray-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'appointment_reminder':
        return 'bg-blue-50 border-blue-200'
      case 'payment_due':
        return 'bg-orange-50 border-orange-200'
      case 'system':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `Hace ${diffInHours} h`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `Hace ${diffInDays} d`
  }

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    
    // Handle different notification types
    if (notification.type === 'appointment_reminder' && notification.data) {
      // Navigate to appointment or show details
      toast.info(`Cita con ${notification.data.paciente_nombre} - ${notification.data.fecha} ${notification.data.hora}`)
    } else if (notification.type === 'payment_due' && notification.data) {
      // Navigate to payment section
      toast.info(`Pago pendiente por atención a ${notification.data.paciente_nombre}`)
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Notificaciones</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Marcar todo como leído
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      getNotificationColor(notification.type)
                    } ${!notification.read ? 'bg-blue-50' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification.id)
                          }}
                          className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  notificationService.clearOldNotifications()
                  loadNotifications()
                  toast.success('Notificaciones antiguas eliminadas')
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar notificaciones antiguas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Notifications
