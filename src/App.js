import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig, appId } from './firebaseConfig';
import logo from './images/barbershop_logo_64x64.png';

// Ensure Tailwind CSS is loaded (assumed to be available in the environment)
// You might need to add <script src="https://cdn.tailwindcss.com"></script> in your HTML if not already present.

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [selectedService, setSelectedService] = useState('Haircut');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [message, setMessage] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    // Firebase Initialization and Authentication
    useEffect(() => {
        try {

            if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
              console.error("Firebase config is missing.");
              setMessage("Error: Firebase configuration is missing.");
            return;
            }

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            // Sign in with custom token or anonymously
            signInAnonymously(firebaseAuth)
    .then((userCredential) => {
        console.log("Signed in anonymously:", userCredential.user.uid);
    })
    .catch((error) => {
        console.error("Error signing in anonymously:", error);
        setMessage(`Error signing in: ${error.message}`);
    });

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                    console.log("Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    setIsAuthReady(true); // Still set to true so data fetching can proceed (e.g., for public data)
                    console.log("Auth state changed, no user.");
                }
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setMessage(`Error initializing Firebase: ${error.message}`);
        }
    }, []);

    // Fetch appointments when auth is ready and db is available
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
            setMessage(`Error fetching appointments: ${error.message}`);
        });

        return () => unsubscribe();
    }
}, [db, isAuthReady]);

    // Generate available time slots based on selected date and existing appointments
    useEffect(() => {
        if (selectedDate) {
            const generateTimeSlots = () => {
                const slots = [];
                const startHour = 9; // 9 AM
                const endHour = 17; // 5 PM
                const intervalMinutes = 30; // 30-minute appointments

                const selectedDateTime = new Date(selectedDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize today to start of day

                // If selected date is today, start from current time + interval
                let currentHour = startHour;
                let currentMinute = 0;

                if (selectedDateTime.toDateString() === today.toDateString()) {
                    const now = new Date();
                    currentHour = now.getHours();
                    currentMinute = now.getMinutes();

                    // Round up to the next interval
                    if (currentMinute % intervalMinutes !== 0) {
                        currentMinute = Math.ceil(currentMinute / intervalMinutes) * intervalMinutes;
                        if (currentMinute >= 60) {
                            currentHour += Math.floor(currentMinute / 60);
                            currentMinute %= 60;
                        }
                    }
                }

                for (let h = currentHour; h < endHour; h++) {
                    for (let m = (h === currentHour ? currentMinute : 0); m < 60; m += intervalMinutes) {
                        const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        const slotDateTime = new Date(selectedDate);
                        slotDateTime.setHours(h, m, 0, 0);

                        // Check if the slot is in the past
                        if (slotDateTime < new Date()) {
                            continue;
                        }

                        // Check for existing appointments overlapping with this slot
                        const isBooked = appointments.some(appt => {
                            const apptDate = new Date(appt.date);
                            const apptTime = new Date(`${appt.date}T${appt.time}`); // Combine date and time for full comparison

                            // Check if the appointment is on the same day
                            if (apptDate.toDateString() === selectedDateTime.toDateString()) {
                                const apptSlotStart = new Date(appt.date);
                                apptSlotStart.setHours(parseInt(appt.time.split(':')[0]), parseInt(appt.time.split(':')[1]), 0, 0);
                                const apptSlotEnd = new Date(apptSlotStart.getTime() + intervalMinutes * 60 * 1000); // Assuming 30 min duration

                                // Check for overlap
                                // Slot starts during existing appointment OR existing appointment starts during slot
                                return (slotDateTime >= apptSlotStart && slotDateTime < apptSlotEnd) ||
                                       (apptSlotStart >= slotDateTime && apptSlotStart < new Date(slotDateTime.getTime() + intervalMinutes * 60 * 1000));
                            }
                            return false;
                        });

                        if (!isBooked) {
                            slots.push(slotTime);
                        }
                    }
                }
                return slots;
            };
            setAvailableTimeSlots(generateTimeSlots());
            setSelectedTime(''); // Reset selected time when date changes
        }
    }, [selectedDate, appointments]); // Re-run when selectedDate or appointments change

    const services = ['Haircut', 'Beard Trim', 'Shave', 'Haircut & Beard Trim'];

    const showMessageModal = (title, content, action = null) => {
        setModalTitle(title);
        setModalContent(content);
        setConfirmAction(() => action); // Use a function to set the action
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalTitle('');
        setModalContent('');
        setConfirmAction(null);
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
            showMessageModal('Error', 'Firebase not initialized or user not authenticated. Please try again.');
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
            bookedBy: userId, // Store the user ID who booked it
            createdAt: new Date().toISOString()
        };

        // Check for double booking before adding
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
            // Clear form fields after successful booking
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
                    await deleteDoc(doc(db, `appointments`, id));
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 text-white font-inter p-4 sm:p-8 flex flex-col items-center">
            {/* User ID Display */}
            <div className="mb-6 bg-gray-800 p-3 rounded-lg shadow-lg w-full max-w-4xl text-center">
                <p className="text-sm text-gray-400">Your User ID: <span className="font-mono text-blue-400 break-words">{userId || 'Loading...'}</span></p>
            </div>

            <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-10 mb-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    Barber Shop Booking
                </h1>

                {/* Booking Form */}
                <form onSubmit={handleBookAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="clientName" className="block text-gray-300 text-sm font-bold mb-2">
                            Your Name
                        </label>
                        <input
                            type="text"
                            id="clientName"
                            className="shadow appearance-none border border-gray-600 rounded-lg w-full py-3 px-4 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 placeholder-gray-400"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="clientContact" className="block text-gray-300 text-sm font-bold mb-2">
                            Contact Info (Email/Phone)
                        </label>
                        <input
                            type="text"
                            id="clientContact"
                            className="shadow appearance-none border border-gray-600 rounded-lg w-full py-3 px-4 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 placeholder-gray-400"
                            value={clientContact}
                            onChange={(e) => setClientContact(e.target.value)}
                            placeholder="john.doe@example.com or 555-1234"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="service" className="block text-gray-300 text-sm font-bold mb-2">
                            Service
                        </label>
                        <select
                            id="service"
                            className="shadow border border-gray-600 rounded-lg w-full py-3 px-4 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 appearance-none pr-8"
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            required
                        >
                            {services.map(service => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-gray-300 text-sm font-bold mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            id="date"
                            className="shadow appearance-none border border-gray-600 rounded-lg w-full py-3 px-4 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={getMinDate()}
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="time" className="block text-gray-300 text-sm font-bold mb-2">
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
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-gray-700 text-gray-200 hover:bg-purple-500 hover:text-white'
                                            }`}
                                        onClick={() => setSelectedTime(slot)}
                                    >
                                        {slot}
                                    </button>
                                ))
                            ) : (
                                <p className="col-span-full text-gray-400 text-center">
                                    {selectedDate ? 'No available slots for this date.' : 'Please select a date to see available slots.'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-2 flex justify-center mt-6">
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-300"
                            disabled={!selectedTime || !isAuthReady}
                        >
                            Book Appointment
                        </button>
                    </div>
                </form>
            </div>

            {/* Existing Appointments */}
            <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-10">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-600">
                    Your Booked Appointments
                </h2>
                {appointments.length === 0 ? (
                    <p className="text-center text-gray-400 text-lg">No appointments booked yet.</p>
                ) : (
                    <div className="space-y-4">
                        {appointments
                            .filter(appt => appt.bookedBy === userId) // Filter appointments booked by the current user
                            .sort((a, b) => {
                                const dateA = new Date(`${a.date}T${a.time}`);
                                const dateB = new Date(`${b.date}T${b.time}`);
                                return dateA - dateB;
                            })
                            .map((appointment) => (
                                <div key={appointment.id} className="bg-gray-700 p-5 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div>
                                        <p className="text-xl font-semibold text-purple-300">{appointment.service}</p>
                                        <p className="text-gray-300">
                                            <span className="font-medium">Date:</span> {appointment.date}
                                        </p>
                                        <p className="text-gray-300">
                                            <span className="font-medium">Time:</span> {appointment.time}
                                        </p>
                                        <p className="text-gray-400 text-sm">
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
                            <div className="mt-8 pt-4 border-t border-gray-600">
                                <h3 className="text-2xl font-bold text-center mb-4 text-gray-400">Other Booked Appointments</h3>
                                <div className="space-y-3">
                                    {appointments
                                        .filter(appt => appt.bookedBy !== userId)
                                        .sort((a, b) => {
                                            const dateA = new Date(`${a.date}T${a.time}`);
                                            const dateB = new Date(`${b.date}T${b.time}`);
                                            return dateA - dateB;
                                        })
                                        .map((appointment) => (
                                        <div key={appointment.id} className="bg-gray-600 p-4 rounded-lg shadow-sm">
                                            <p className="text-lg font-semibold text-blue-300">{appointment.service}</p>
                                            <p className="text-gray-300">Date: {appointment.date}, Time: {appointment.time}</p>
                                            <p className="text-gray-400 text-sm">Booked by: {appointment.bookedBy}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for Messages/Confirmations */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full border border-gray-600">
                        <h3 className="text-2xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                            {modalTitle}
                        </h3>
                        <p className="text-gray-300 text-center mb-6">{modalContent}</p>
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
                                className={`${confirmAction ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-2 px-5 rounded-full shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            >
                                {confirmAction ? 'Cancel' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
