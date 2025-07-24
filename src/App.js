import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import logo from './images/barbershop_logo_64x64.png';
import Header from './Header';

const App = () => {
    // Make Header login button open the login modal
    const [userEmail, setUserEmail] = useState(null);
    useEffect(() => {
        window.onHeaderLoginClick = () => {
            setModalTitle('Login Required');
            setModalContent('Please log in to book an appointment.');
            setShowModal(true);
        };
        
        // Apply background color to document for overscroll effect
        document.documentElement.style.backgroundColor = '#f8f9fa';
        document.body.style.backgroundColor = '#f8f9fa';

        return () => {
            window.onHeaderLoginClick = undefined;
        };
    }, []);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [selectedService, setSelectedService] = useState('Haircut');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [email, setEmail] = useState(''); // For login modal
    const [password, setPassword] = useState(''); // For login modal
    const [isLoggedIn, setIsLoggedIn] = useState(false); // Track login status

    useEffect(() => {
        try {
            if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is missing.");
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const auth = getAuth(app);

            setDb(firestore);

            signInAnonymously(auth)
                .catch((error) => {
                    console.error("Error signing in anonymously:", error);
                });

            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsLoggedIn(!!user.email);
                    setUserEmail(user.email || null);
                    setIsAuthReady(true);
                    console.log("Auth state changed, user ID:", user.uid, "Email:", user.email);
                } else {
                    setUserId(null);
                    setIsLoggedIn(false);
                    setUserEmail(null);
                    setIsAuthReady(true);
                    console.log("Auth state changed, no user.");
                }
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }, []);

    useEffect(() => {
        if (db && isAuthReady) {
            const appointmentsCollectionRef = collection(db, 'appointments');

            const unsubscribe = onSnapshot(appointmentsCollectionRef, (snapshot) => {
                const fetchedAppointments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setAppointments(fetchedAppointments);
                console.log("Appointments fetched:", fetchedAppointments);
            }, (error) => {
                console.error("Error fetching appointments:", error);
            });

            return () => unsubscribe();
        }
    }, [db, isAuthReady]);

    useEffect(() => {
        if (!selectedDate) return;

        const generateTimeSlots = () => {
            const slots = [];
            const startHour = 9;
            const endHour = 17;
            const intervalMinutes = 30;
            const selectedDateTime = new Date(selectedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let currentHour = startHour;
            let currentMinute = 0;

            if (selectedDateTime.toDateString() === today.toDateString()) {
                const now = new Date();
                currentHour = now.getHours();
                currentMinute = now.getMinutes();

                if (currentMinute % intervalMinutes !== 0) {
                    currentMinute = Math.ceil(currentMinute / intervalMinutes) * intervalMinutes;
                    if (currentMinute >= 60) {
                        currentHour += Math.floor(currentMinute / 60);
                        currentMinute %= 60;
                    }
                }
                if (currentHour < 23 || (currentHour === 23 && currentMinute < 35)) { // 11:35 PM rounds to 11:30 PM
                    currentHour = 23;
                    currentMinute = 30;
                }
            }

            for (let h = currentHour; h <= endHour; h++) {
                for (let m = (h === currentHour ? currentMinute : 0); m < 60; m += intervalMinutes) {
                    const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    const slotDateTime = new Date(selectedDate);
                    slotDateTime.setHours(h, m, 0, 0);

                    if (slotDateTime >= new Date()) {
                        const isBooked = appointments.some(appt => appt.date === selectedDate && appt.time === slotTime);
                        if (!isBooked) slots.push(slotTime);
                    }
                }
            }
            return slots;
        };

        const slots = generateTimeSlots();
        setAvailableTimeSlots(slots);
        if (slots.length > 0) setSelectedTime(slots[0]);
    }, [selectedDate, appointments]);

    const services = ['Haircut', 'Beard Trim', 'Shave', 'Haircut & Beard Trim'];

    const showMessageModal = (title, content, action = null) => {
        setModalTitle(title);
        setModalContent(content);
        setConfirmAction(() => action);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalTitle('');
        setModalContent('');
        setConfirmAction(null);
        setEmail('');
        setPassword('');
    };

    const handleConfirmModal = () => {
        if (confirmAction) {
            confirmAction();
        }
        closeModal();
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();

        if (!db || !userId) {
            showMessageModal('Error', 'Firebase not initialized or user not authenticated.');
            return;
        }

        if (!isLoggedIn) {
            showMessageModal('Login Required', 'Please log in to book this appointment.', () => handleLogin());
            return;
        }

        if (!clientName || !clientContact || !selectedService || !selectedDate || !selectedTime) {
            showMessageModal('Validation Error', 'Please fill in all fields.');
            return;
        }

        const newAppointment = {
            clientName,
            clientContact,
            service: selectedService,
            date: selectedDate,
            time: selectedTime,
            bookedBy: userId,
            createdAt: new Date().toISOString()
        };

        const isDoubleBooked = appointments.some(appt =>
            appt.date === selectedDate && appt.time === selectedTime
        );

        if (isDoubleBooked) {
            showMessageModal('Booking Conflict', 'This time slot is no longer available. Please choose another one.');
            return;
        }

        try {
            await addDoc(collection(db, 'appointments'), newAppointment);
            showMessageModal('Success', 'Appointment booked successfully!');
            setClientName('');
            setClientContact('');
            setSelectedService('Haircut');
            setSelectedDate('');
            setSelectedTime('');
        } catch (error) {
            console.error("Error adding document: ", error);
            showMessageModal('Error', `Failed to book appointment: ${error.message}`);
        }
    };

    const handleDeleteAppointment = (id) => {
        showMessageModal(
            'Confirm Deletion',
            'Are you sure you want to delete this appointment?',
            async () => {
                if (!db || !userId) {
                    showMessageModal('Error', 'Firebase not initialized or user not authenticated.');
                    return;
                }
                try {
                    await deleteDoc(doc(db, 'appointments', id));
                    showMessageModal('Success', 'Appointment deleted successfully!');
                } catch (error) {
                    console.error("Error deleting document: ", error);
                    showMessageModal('Error', `Failed to delete appointment: ${error.message}`);
                }
            }
        );
    };

    const getMinDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleLogin = async (e) => {
        e?.preventDefault(); // Optional event for modal form
        const auth = getAuth();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            closeModal(); // Close modal after successful login
        } catch (error) {
            console.error("Login error:", error);
        }
    };

    return (
        <div className="page-wrapper">
            <Header userEmail={userEmail} />
            <div className="min-h-screen text-gray-800 font-inter p-4 sm:p-8 flex flex-col items-center">
            {/* User ID and Login Status Display (hidden) */}

            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-10 mb-8">
                <div className="flex items-center justify-center mb-6">
                    <img src={logo} alt="Barber Shop Logo" className="h-12 mr-4" />
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-800">
                        Victor's Barber Studio
                    </h1>
                </div>

                <form onSubmit={handleBookAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="clientName" className="block text-gray-700 text-sm font-bold mb-2">
                            Your Name
                        </label>
                        <input
                            type="text"
                            id="clientName"
                            className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white placeholder-gray-500"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="John Doe"
                            required
                            disabled={!isLoggedIn}
                        />
                    </div>
                    <div>
                        <label htmlFor="clientContact" className="block text-gray-700 text-sm font-bold mb-2">
                            Contact Info (Email/Phone)
                        </label>
                        <input
                            type="text"
                            id="clientContact"
                            className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white placeholder-gray-500"
                            value={clientContact}
                            onChange={(e) => setClientContact(e.target.value)}
                            placeholder="john.doe@example.com or 555-1234"
                            required
                            disabled={!isLoggedIn}
                        />
                    </div>
                    <div>
                        <label htmlFor="service" className="block text-gray-700 text-sm font-bold mb-2">
                            Service
                        </label>
                        <select
                            id="service"
                            className="shadow border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white appearance-none pr-8"
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            required
                            disabled={!isLoggedIn}
                        >
                            {services.map(service => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-gray-700 text-sm font-bold mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            id="date"
                            className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={getMinDate()}
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="time" className="block text-gray-700 text-sm font-bold mb-2">
                            Available Time Slots
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {availableTimeSlots.length > 0 ? (
                                availableTimeSlots.map(slot => (
                                    <button
                                        key={slot}
                                        type="button"
                                        className={`py-2 px-4 rounded-lg font-semibold transition duration-200 ease-in-out
                                            ${selectedTime === slot
                                                ? 'bg-green-600 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-700 hover:bg-green-500 hover:text-white border border-gray-300'
                                            }`}
                                        onClick={() => setSelectedTime(slot)}
                                    >
                                        {slot}
                                    </button>
                                ))
                            ) : (
                                <p className="col-span-full text-gray-600 text-center">
                                    {selectedDate ? 'No available slots for this date.' : 'Please select a date to see available slots.'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-2 flex justify-center mt-6">
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-green-300"
                            disabled={!selectedTime || !isAuthReady || !isLoggedIn}
                        >
                            Book Appointment
                        </button>
                    </div>
                </form>
            </div>

            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-10">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-800">
                    Your Booked Appointments
                </h2>
                {appointments.length === 0 ? (
                    <p className="text-center text-gray-600 text-lg">No appointments booked yet.</p>
                ) : (
                    <div className="space-y-4">
                        {appointments
                            .filter(appt => appt.bookedBy === userId)
                            .sort((a, b) => {
                                const dateA = new Date(`${a.date}T${a.time}`);
                                const dateB = new Date(`${b.date}T${b.time}`);
                                return dateA - dateB;
                            })
                            .map((appointment) => (
                                <div key={appointment.id} className="bg-gray-50 border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div>
                                        <p className="text-xl font-semibold text-green-700">{appointment.service}</p>
                                        <p className="text-gray-600">
                                            <span className="font-medium">Date:</span> {appointment.date}
                                        </p>
                                        <p className="text-gray-600">
                                            <span className="font-medium">Time:</span> {appointment.time}
                                        </p>
                                        <p className="text-gray-500 text-sm">
                                            Client: {appointment.clientName} ({appointment.clientContact})
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAppointment(appointment.id)}
                                        className="mt-4 sm:mt-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))
                        }
                        {appointments.filter(appt => appt.bookedBy !== userId).length > 0 && (
                            <div className="mt-8 pt-4 border-t border-gray-300">
                                <h3 className="text-2xl font-bold text-center mb-4 text-gray-600">Other Booked Appointments</h3>
                                <div className="space-y-3">
                                    {appointments
                                        .filter(appt => appt.bookedBy !== userId)
                                        .sort((a, b) => {
                                            const dateA = new Date(`${a.date}T${a.time}`);
                                            const dateB = new Date(`${b.date}T${b.time}`);
                                            return dateA - dateB;
                                        })
                                        .map((appointment) => (
                                            <div key={appointment.id} className="bg-gray-100 border border-gray-200 p-4 rounded-lg shadow-sm">
                                                <p className="text-lg font-semibold text-green-600">{appointment.service}</p>
                                                <p className="text-gray-600">Date: {appointment.date}, Time: {appointment.time}</p>
                                                <p className="text-gray-500 text-sm">Booked by: {appointment.bookedBy}</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full border border-gray-300">
                        <h3 className="text-2xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-800">
                            {modalTitle}
                        </h3>
                        {modalTitle === 'Login Required' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
                                <div>
                                    <label htmlFor="modal-email" className="block text-gray-700 text-sm font-bold mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="modal-email"
                                        className="shadow appearance-none border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white placeholder-gray-500"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="modal-password" className="block text-gray-700 text-sm font-bold mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        id="modal-password"
                                        className="shadow appearance-none border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-white placeholder-gray-500"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-green-300 w-full"
                                >
                                    Login
                                </button>
                            </form>
                        )}
                        <p className="text-gray-700 text-center mb-6">{modalContent}</p>
                        <div className="flex justify-center space-x-4">
                            {confirmAction && (
                                <button
                                    onClick={handleConfirmModal}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    Confirm
                                </button>
                            )}
                            <button
                                onClick={closeModal}
                                className={`${confirmAction ? 'bg-gray-400 hover:bg-gray-500' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500`}
                            >
                                {confirmAction ? 'Cancel' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default App;