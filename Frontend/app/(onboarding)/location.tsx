import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { ChevronLeftIcon, SearchIcon, GpsTargetIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { LeafletMapHost } from '../../components/LeafletMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const cities = [
  { name: 'Bangalore' },
  { name: 'Mumbai' },
  { name: 'Delhi' },
  { name: 'Goa' },
];

// Searchable location database (major Indian cities with coordinates) used to
// suggest nearby places when the user types and to resolve the GPS fix to a
// city name. No network call needed.
const CITY_DB: { name: string; state: string; lat: number; lng: number }[] = [
  { name: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777 },
  { name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lng: 80.3319 },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lng: 73.1812 },
  { name: 'Ludhiana', state: 'Punjab', lat: 30.901, lng: 75.8573 },
  { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  { name: 'Faridabad', state: 'Haryana', lat: 28.4089, lng: 77.3178 },
  { name: 'Meerut', state: 'Uttar Pradesh', lat: 28.9845, lng: 77.7064 },
  { name: 'Rajkot', state: 'Gujarat', lat: 22.3039, lng: 70.8022 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  { name: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  { name: 'Amritsar', state: 'Punjab', lat: 31.634, lng: 74.8723 },
  { name: 'Prayagraj', state: 'Uttar Pradesh', lat: 25.4358, lng: 81.8463 },
  { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lng: 85.3096 },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { name: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lng: 76.9366 },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
  { name: 'Kota', state: 'Rajasthan', lat: 25.2138, lng: 75.8648 },
  { name: 'Panaji', state: 'Goa', lat: 15.4909, lng: 73.8278 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322 },
  { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  { name: 'Aurangabad', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  { name: 'Gwalior', state: 'Madhya Pradesh', lat: 26.2183, lng: 78.1828 },
  { name: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.1815, lng: 79.9864 },
  { name: 'Jalandhar', state: 'Punjab', lat: 31.326, lng: 75.5762 },
  { name: 'Gaya', state: 'Bihar', lat: 24.7914, lng: 85.0002 },
  { name: 'Dhanbad', state: 'Jharkhand', lat: 23.7957, lng: 86.4304 },
  { name: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lng: 81.6296 },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { name: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5062, lng: 80.648 },
  { name: 'Warangal', state: 'Telangana', lat: 17.9689, lng: 79.5941 },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', lat: 10.7905, lng: 78.7047 },
  { name: 'Salem', state: 'Tamil Nadu', lat: 11.6643, lng: 78.146 },
  { name: 'Vellore', state: 'Tamil Nadu', lat: 12.9165, lng: 79.1325 },
  { name: 'Puducherry', state: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  { name: 'Siliguri', state: 'West Bengal', lat: 26.7271, lng: 88.3953 },
  { name: 'Jamshedpur', state: 'Jharkhand', lat: 22.8046, lng: 86.2029 },
  { name: 'Cuttack', state: 'Odisha', lat: 20.4625, lng: 85.8828 },
  { name: 'Noida', state: 'Uttar Pradesh', lat: 28.5355, lng: 77.391 },
  { name: 'Gurugram', state: 'Haryana', lat: 28.4595, lng: 77.0266 },
  { name: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lng: 77.4538 },
  { name: 'Bareilly', state: 'Uttar Pradesh', lat: 28.367, lng: 79.4304 },
  { name: 'Moradabad', state: 'Uttar Pradesh', lat: 28.8386, lng: 78.7733 },
  { name: 'Saharanpur', state: 'Uttar Pradesh', lat: 29.964, lng: 77.546 },
  { name: 'Gorakhpur', state: 'Uttar Pradesh', lat: 26.7606, lng: 83.3732 },
  { name: 'Jhansi', state: 'Uttar Pradesh', lat: 25.4484, lng: 78.5685 },
  { name: 'Mathura', state: 'Uttar Pradesh', lat: 27.4924, lng: 77.6737 },
  { name: 'Karnal', state: 'Haryana', lat: 29.6857, lng: 76.9905 },
  { name: 'Panipat', state: 'Haryana', lat: 29.3909, lng: 76.9635 },
  { name: 'Hisar', state: 'Haryana', lat: 29.1492, lng: 75.7217 },
  { name: 'Rohtak', state: 'Haryana', lat: 28.8955, lng: 76.6066 },
  { name: 'Bathinda', state: 'Punjab', lat: 30.211, lng: 74.9455 },
  { name: 'Patiala', state: 'Punjab', lat: 30.3398, lng: 76.3869 },
  { name: 'Gangtok', state: 'Sikkim', lat: 27.3389, lng: 88.6065 },
  { name: 'Imphal', state: 'Manipur', lat: 24.817, lng: 93.9368 },
  { name: 'Aizawl', state: 'Mizoram', lat: 23.7271, lng: 92.7176 },
  { name: 'Shillong', state: 'Meghalaya', lat: 25.5788, lng: 91.8933 },
  { name: 'Kohima', state: 'Nagaland', lat: 25.6751, lng: 94.1086 },
  { name: 'Agartala', state: 'Tripura', lat: 23.8315, lng: 91.2868 },
  { name: 'Itanagar', state: 'Arunachal Pradesh', lat: 27.0844, lng: 93.6053 },
  { name: 'Port Blair', state: 'Andaman & Nicobar', lat: 11.6234, lng: 92.7265 },
  { name: 'Leh', state: 'Ladakh', lat: 34.1526, lng: 77.5771 },
  { name: 'Haridwar', state: 'Uttarakhand', lat: 29.9457, lng: 78.1642 },
  { name: 'Rishikesh', state: 'Uttarakhand', lat: 30.0869, lng: 78.2676 },
  { name: 'Darjeeling', state: 'West Bengal', lat: 27.041, lng: 88.2663 },
  { name: 'Ooty', state: 'Tamil Nadu', lat: 11.4064, lng: 76.6932 },
  { name: 'Kodaikanal', state: 'Tamil Nadu', lat: 10.2381, lng: 77.4892 },
  { name: 'Kanyakumari', state: 'Tamil Nadu', lat: 8.0883, lng: 77.5385 },
  { name: 'Tirupati', state: 'Andhra Pradesh', lat: 13.6288, lng: 79.4192 },
  { name: 'Nellore', state: 'Andhra Pradesh', lat: 14.4426, lng: 79.9865 },
  { name: 'Guntur', state: 'Andhra Pradesh', lat: 16.3067, lng: 80.4365 },
  { name: 'Rajahmundry', state: 'Andhra Pradesh', lat: 17.0005, lng: 81.804 },
  { name: 'Eluru', state: 'Andhra Pradesh', lat: 16.7107, lng: 81.0952 },
  { name: 'Anantapur', state: 'Andhra Pradesh', lat: 14.6819, lng: 77.6006 },
  { name: 'Nizamabad', state: 'Telangana', lat: 18.6725, lng: 78.0941 },
  { name: 'Karimnagar', state: 'Telangana', lat: 18.4386, lng: 79.1288 },
  { name: 'Khammam', state: 'Telangana', lat: 17.2473, lng: 80.1514 },
  { name: 'Suryapet', state: 'Telangana', lat: 17.141, lng: 79.619 },
  { name: 'Nalgonda', state: 'Telangana', lat: 17.0552, lng: 79.2685 },
];

// Well-known streets, localities and landmarks per city (approximate
// coordinates) so typing a street name suggests nearby places, ranked
// nearest-first once the GPS fix is known.
const PLACES_DB: { name: string; city: string; state: string; lat: number; lng: number; kind: string }[] = [
  // Bangalore
  { name: 'MG Road', city: 'Bangalore', state: 'Karnataka', lat: 12.9757, lng: 77.6068, kind: 'Street' },
  { name: 'Brigade Road', city: 'Bangalore', state: 'Karnataka', lat: 12.9719, lng: 77.6075, kind: 'Street' },
  { name: 'Koramangala', city: 'Bangalore', state: 'Karnataka', lat: 12.9352, lng: 77.6245, kind: 'Area' },
  { name: 'Indiranagar', city: 'Bangalore', state: 'Karnataka', lat: 12.9719, lng: 77.6412, kind: 'Area' },
  { name: 'Whitefield', city: 'Bangalore', state: 'Karnataka', lat: 12.9698, lng: 77.75, kind: 'Area' },
  { name: 'Electronic City', city: 'Bangalore', state: 'Karnataka', lat: 12.8452, lng: 77.6602, kind: 'Area' },
  { name: 'Jayanagar', city: 'Bangalore', state: 'Karnataka', lat: 12.9308, lng: 77.5838, kind: 'Area' },
  { name: 'Malleshwaram', city: 'Bangalore', state: 'Karnataka', lat: 13.0031, lng: 77.5613, kind: 'Area' },
  { name: 'HSR Layout', city: 'Bangalore', state: 'Karnataka', lat: 12.9121, lng: 77.6446, kind: 'Area' },
  { name: 'Lalbagh', city: 'Bangalore', state: 'Karnataka', lat: 12.9507, lng: 77.5848, kind: 'Landmark' },
  { name: 'Cubbon Park', city: 'Bangalore', state: 'Karnataka', lat: 12.9763, lng: 77.5929, kind: 'Landmark' },
  { name: 'Sarjapur Road', city: 'Bangalore', state: 'Karnataka', lat: 12.9063, lng: 77.6854, kind: 'Street' },
  { name: 'Banashankari', city: 'Bangalore', state: 'Karnataka', lat: 12.9254, lng: 77.5467, kind: 'Area' },
  { name: 'Yelahanka', city: 'Bangalore', state: 'Karnataka', lat: 13.1005, lng: 77.5963, kind: 'Area' },
  { name: 'Hebbal', city: 'Bangalore', state: 'Karnataka', lat: 13.0358, lng: 77.5965, kind: 'Area' },
  // Mumbai
  { name: 'Marine Drive', city: 'Mumbai', state: 'Maharashtra', lat: 18.9435, lng: 72.8237, kind: 'Street' },
  { name: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', lat: 19.0596, lng: 72.8295, kind: 'Area' },
  { name: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', lat: 19.1136, lng: 72.8697, kind: 'Area' },
  { name: 'Juhu Beach', city: 'Mumbai', state: 'Maharashtra', lat: 19.0889, lng: 72.8263, kind: 'Landmark' },
  { name: 'Colaba Causeway', city: 'Mumbai', state: 'Maharashtra', lat: 18.9217, lng: 72.8328, kind: 'Street' },
  { name: 'Linking Road', city: 'Mumbai', state: 'Maharashtra', lat: 19.0759, lng: 72.8308, kind: 'Street' },
  { name: 'Worli Sea Face', city: 'Mumbai', state: 'Maharashtra', lat: 19.0023, lng: 72.8165, kind: 'Landmark' },
  { name: 'Powai', city: 'Mumbai', state: 'Maharashtra', lat: 19.1176, lng: 72.906, kind: 'Area' },
  { name: 'Dadar', city: 'Mumbai', state: 'Maharashtra', lat: 19.0178, lng: 72.8478, kind: 'Area' },
  { name: 'Lower Parel', city: 'Mumbai', state: 'Maharashtra', lat: 18.9935, lng: 72.8271, kind: 'Area' },
  { name: 'BKC', city: 'Mumbai', state: 'Maharashtra', lat: 19.0649, lng: 72.8623, kind: 'Area' },
  { name: 'Goregaon', city: 'Mumbai', state: 'Maharashtra', lat: 19.1656, lng: 72.8495, kind: 'Area' },
  { name: 'Vashi', city: 'Mumbai', state: 'Maharashtra', lat: 19.0772, lng: 73.0009, kind: 'Area' },
  { name: 'CST Station', city: 'Mumbai', state: 'Maharashtra', lat: 18.9398, lng: 72.8355, kind: 'Landmark' },
  { name: 'Thane', city: 'Mumbai', state: 'Maharashtra', lat: 19.2183, lng: 72.9781, kind: 'Area' },
  // Delhi
  { name: 'Connaught Place', city: 'Delhi', state: 'Delhi', lat: 28.6315, lng: 77.2167, kind: 'Area' },
  { name: 'Chandni Chowk', city: 'Delhi', state: 'Delhi', lat: 28.6506, lng: 77.2303, kind: 'Area' },
  { name: 'Hauz Khas Village', city: 'Delhi', state: 'Delhi', lat: 28.5494, lng: 77.2002, kind: 'Area' },
  { name: 'Karol Bagh', city: 'Delhi', state: 'Delhi', lat: 28.6519, lng: 77.1909, kind: 'Area' },
  { name: 'Lajpat Nagar', city: 'Delhi', state: 'Delhi', lat: 28.5665, lng: 77.2405, kind: 'Area' },
  { name: 'Saket', city: 'Delhi', state: 'Delhi', lat: 28.5236, lng: 77.2065, kind: 'Area' },
  { name: 'Dwarka', city: 'Delhi', state: 'Delhi', lat: 28.5921, lng: 77.046, kind: 'Area' },
  { name: 'Rohini', city: 'Delhi', state: 'Delhi', lat: 28.7259, lng: 77.0877, kind: 'Area' },
  { name: 'India Gate', city: 'Delhi', state: 'Delhi', lat: 28.6129, lng: 77.2295, kind: 'Landmark' },
  { name: 'Qutub Minar', city: 'Delhi', state: 'Delhi', lat: 28.5245, lng: 77.1855, kind: 'Landmark' },
  { name: 'Rajouri Garden', city: 'Delhi', state: 'Delhi', lat: 28.6467, lng: 77.1189, kind: 'Area' },
  { name: 'Janakpuri', city: 'Delhi', state: 'Delhi', lat: 28.6219, lng: 77.0866, kind: 'Area' },
  { name: 'Vasant Kunj', city: 'Delhi', state: 'Delhi', lat: 28.5255, lng: 77.1555, kind: 'Area' },
  { name: 'Mehrauli', city: 'Delhi', state: 'Delhi', lat: 28.5176, lng: 77.1791, kind: 'Area' },
  { name: 'Pitampura', city: 'Delhi', state: 'Delhi', lat: 28.6947, lng: 77.1338, kind: 'Area' },
  // Hyderabad
  { name: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', lat: 17.4146, lng: 78.4374, kind: 'Area' },
  { name: 'Jubilee Hills', city: 'Hyderabad', state: 'Telangana', lat: 17.4319, lng: 78.4084, kind: 'Area' },
  { name: 'Hitech City', city: 'Hyderabad', state: 'Telangana', lat: 17.4435, lng: 78.3772, kind: 'Area' },
  { name: 'Gachibowli', city: 'Hyderabad', state: 'Telangana', lat: 17.4401, lng: 78.3489, kind: 'Area' },
  { name: 'Charminar', city: 'Hyderabad', state: 'Telangana', lat: 17.3616, lng: 78.4747, kind: 'Landmark' },
  { name: 'Secunderabad', city: 'Hyderabad', state: 'Telangana', lat: 17.4399, lng: 78.4983, kind: 'Area' },
  { name: 'Kukatpally', city: 'Hyderabad', state: 'Telangana', lat: 17.4948, lng: 78.4132, kind: 'Area' },
  { name: 'Madhapur', city: 'Hyderabad', state: 'Telangana', lat: 17.4483, lng: 78.3915, kind: 'Area' },
  { name: 'Ameerpet', city: 'Hyderabad', state: 'Telangana', lat: 17.4375, lng: 78.4483, kind: 'Area' },
  { name: 'Begumpet', city: 'Hyderabad', state: 'Telangana', lat: 17.4448, lng: 78.4667, kind: 'Area' },
  { name: 'Dilsukhnagar', city: 'Hyderabad', state: 'Telangana', lat: 17.3654, lng: 78.5263, kind: 'Area' },
  { name: 'Uppal', city: 'Hyderabad', state: 'Telangana', lat: 17.4058, lng: 78.5592, kind: 'Area' },
  { name: 'Kondapur', city: 'Hyderabad', state: 'Telangana', lat: 17.4646, lng: 78.3648, kind: 'Area' },
  { name: 'Nampally', city: 'Hyderabad', state: 'Telangana', lat: 17.3897, lng: 78.4703, kind: 'Area' },
  { name: 'Abids', city: 'Hyderabad', state: 'Telangana', lat: 17.3861, lng: 78.4739, kind: 'Area' },
  // Chennai
  { name: 'T. Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0418, lng: 80.2341, kind: 'Area' },
  { name: 'Marina Beach', city: 'Chennai', state: 'Tamil Nadu', lat: 13.05, lng: 80.2824, kind: 'Landmark' },
  { name: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0878, lng: 80.2101, kind: 'Area' },
  { name: 'Velachery', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9778, lng: 80.2187, kind: 'Area' },
  { name: 'Adyar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0012, lng: 80.2565, kind: 'Area' },
  { name: 'Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9999, lng: 80.2673, kind: 'Area' },
  { name: 'OMR', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9304, lng: 80.1987, kind: 'Street' },
  { name: 'Guindy', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0086, lng: 80.2205, kind: 'Area' },
  { name: 'Mylapore', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0367, lng: 80.2673, kind: 'Area' },
  { name: 'Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0629, lng: 80.2431, kind: 'Area' },
  { name: 'Porur', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0358, lng: 80.1577, kind: 'Area' },
  { name: 'Tambaram', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9247, lng: 80.1188, kind: 'Area' },
  { name: 'Saidapet', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0244, lng: 80.2232, kind: 'Area' },
  { name: 'Egmore', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0757, lng: 80.2575, kind: 'Area' },
  { name: 'Anna Salai', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0615, lng: 80.2556, kind: 'Street' },
  // Kolkata
  { name: 'Park Street', city: 'Kolkata', state: 'West Bengal', lat: 22.5521, lng: 88.3537, kind: 'Street' },
  { name: 'Howrah', city: 'Kolkata', state: 'West Bengal', lat: 22.5958, lng: 88.2636, kind: 'Area' },
  { name: 'Salt Lake', city: 'Kolkata', state: 'West Bengal', lat: 22.5846, lng: 88.4154, kind: 'Area' },
  { name: 'New Town', city: 'Kolkata', state: 'West Bengal', lat: 22.5855, lng: 88.4847, kind: 'Area' },
  { name: 'Gariahat', city: 'Kolkata', state: 'West Bengal', lat: 22.5122, lng: 88.3642, kind: 'Area' },
  { name: 'College Street', city: 'Kolkata', state: 'West Bengal', lat: 22.5773, lng: 88.3626, kind: 'Street' },
  { name: 'Ballygunge', city: 'Kolkata', state: 'West Bengal', lat: 22.5226, lng: 88.3598, kind: 'Area' },
  { name: 'Rajarhat', city: 'Kolkata', state: 'West Bengal', lat: 22.5881, lng: 88.4516, kind: 'Area' },
  { name: 'Esplanade', city: 'Kolkata', state: 'West Bengal', lat: 22.5675, lng: 88.3487, kind: 'Area' },
  { name: 'Victoria Memorial', city: 'Kolkata', state: 'West Bengal', lat: 22.5448, lng: 88.3425, kind: 'Landmark' },
  { name: 'Dum Dum', city: 'Kolkata', state: 'West Bengal', lat: 22.6348, lng: 88.4158, kind: 'Area' },
  { name: 'Lake Gardens', city: 'Kolkata', state: 'West Bengal', lat: 22.5148, lng: 88.3949, kind: 'Area' },
  { name: 'Behala', city: 'Kolkata', state: 'West Bengal', lat: 22.5018, lng: 88.3102, kind: 'Area' },
  { name: 'Kasba', city: 'Kolkata', state: 'West Bengal', lat: 22.5238, lng: 88.3928, kind: 'Area' },
  { name: 'Shyambazar', city: 'Kolkata', state: 'West Bengal', lat: 22.6014, lng: 88.3756, kind: 'Area' },
  // Pune
  { name: 'FC Road', city: 'Pune', state: 'Maharashtra', lat: 18.5259, lng: 73.8425, kind: 'Street' },
  { name: 'Koregaon Park', city: 'Pune', state: 'Maharashtra', lat: 18.5373, lng: 73.8935, kind: 'Area' },
  { name: 'Hinjewadi', city: 'Pune', state: 'Maharashtra', lat: 18.5913, lng: 73.6834, kind: 'Area' },
  { name: 'Viman Nagar', city: 'Pune', state: 'Maharashtra', lat: 18.5679, lng: 73.9143, kind: 'Area' },
  { name: 'Kothrud', city: 'Pune', state: 'Maharashtra', lat: 18.5074, lng: 73.8077, kind: 'Area' },
  { name: 'Baner', city: 'Pune', state: 'Maharashtra', lat: 18.5591, lng: 73.7891, kind: 'Area' },
  { name: 'Aundh', city: 'Pune', state: 'Maharashtra', lat: 18.5618, lng: 73.8073, kind: 'Area' },
  { name: 'Hadapsar', city: 'Pune', state: 'Maharashtra', lat: 18.5089, lng: 73.926, kind: 'Area' },
  { name: 'Camp', city: 'Pune', state: 'Maharashtra', lat: 18.5139, lng: 73.8778, kind: 'Area' },
  { name: 'Shivajinagar', city: 'Pune', state: 'Maharashtra', lat: 18.5308, lng: 73.8474, kind: 'Area' },
  { name: 'Wakad', city: 'Pune', state: 'Maharashtra', lat: 18.5939, lng: 73.7635, kind: 'Area' },
  { name: 'Pimpri', city: 'Pune', state: 'Maharashtra', lat: 18.6298, lng: 73.8147, kind: 'Area' },
  { name: 'Swargate', city: 'Pune', state: 'Maharashtra', lat: 18.5002, lng: 73.8631, kind: 'Area' },
  { name: 'Deccan Gymkhana', city: 'Pune', state: 'Maharashtra', lat: 18.5171, lng: 73.8418, kind: 'Area' },
  { name: 'Magarpatta', city: 'Pune', state: 'Maharashtra', lat: 18.5126, lng: 73.9351, kind: 'Area' },
  // Ahmedabad
  { name: 'CG Road', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0304, lng: 72.556, kind: 'Street' },
  { name: 'SG Highway', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0472, lng: 72.5076, kind: 'Street' },
  { name: 'Maninagar', city: 'Ahmedabad', state: 'Gujarat', lat: 22.999, lng: 72.604, kind: 'Area' },
  { name: 'Navrangpura', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0344, lng: 72.5562, kind: 'Area' },
  { name: 'Bodakdev', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0545, lng: 72.5123, kind: 'Area' },
  { name: 'Satellite', city: 'Ahmedabad', state: 'Gujarat', lat: 23.04, lng: 72.5076, kind: 'Area' },
  { name: 'Paldi', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0089, lng: 72.5723, kind: 'Area' },
  { name: 'Vastrapur', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0366, lng: 72.5271, kind: 'Area' },
  { name: 'Chandkheda', city: 'Ahmedabad', state: 'Gujarat', lat: 23.1088, lng: 72.5803, kind: 'Area' },
  { name: 'Thaltej', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0471, lng: 72.5101, kind: 'Area' },
  { name: 'Ellisbridge', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0323, lng: 72.5714, kind: 'Area' },
  { name: 'Sabarmati', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0714, lng: 72.5944, kind: 'Area' },
  { name: 'Nikol', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0423, lng: 72.6547, kind: 'Area' },
  { name: 'Iskcon', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0552, lng: 72.5294, kind: 'Landmark' },
  { name: 'Maninagar Railway', city: 'Ahmedabad', state: 'Gujarat', lat: 22.9979, lng: 72.6047, kind: 'Landmark' },
  // Jaipur
  { name: 'MI Road', city: 'Jaipur', state: 'Rajasthan', lat: 26.9157, lng: 75.8017, kind: 'Street' },
  { name: 'Johari Bazar', city: 'Jaipur', state: 'Rajasthan', lat: 26.9176, lng: 75.8267, kind: 'Area' },
  { name: 'Malviya Nagar', city: 'Jaipur', state: 'Rajasthan', lat: 26.8541, lng: 75.811, kind: 'Area' },
  { name: 'Vaishali Nagar', city: 'Jaipur', state: 'Rajasthan', lat: 26.9127, lng: 75.7634, kind: 'Area' },
  { name: 'C-Scheme', city: 'Jaipur', state: 'Rajasthan', lat: 26.9051, lng: 75.7909, kind: 'Area' },
  { name: 'Bani Park', city: 'Jaipur', state: 'Rajasthan', lat: 26.9185, lng: 75.8005, kind: 'Area' },
  { name: 'Tonk Road', city: 'Jaipur', state: 'Rajasthan', lat: 26.8885, lng: 75.8082, kind: 'Street' },
  { name: 'Amber', city: 'Jaipur', state: 'Rajasthan', lat: 26.9855, lng: 75.8513, kind: 'Landmark' },
  { name: 'Hawa Mahal', city: 'Jaipur', state: 'Rajasthan', lat: 26.9239, lng: 75.8267, kind: 'Landmark' },
  { name: 'Mansarovar', city: 'Jaipur', state: 'Rajasthan', lat: 26.8547, lng: 75.7716, kind: 'Area' },
  { name: 'Jagatpura', city: 'Jaipur', state: 'Rajasthan', lat: 26.833, lng: 75.8546, kind: 'Area' },
  { name: 'Sanganer', city: 'Jaipur', state: 'Rajasthan', lat: 26.8068, lng: 75.7772, kind: 'Area' },
  { name: 'Vidhyadhar Nagar', city: 'Jaipur', state: 'Rajasthan', lat: 26.9416, lng: 75.809, kind: 'Area' },
  { name: 'Gandhi Path', city: 'Jaipur', state: 'Rajasthan', lat: 26.9008, lng: 75.7705, kind: 'Street' },
  { name: 'Ajmer Road', city: 'Jaipur', state: 'Rajasthan', lat: 26.9267, lng: 75.7743, kind: 'Street' },
  // Secondary cities
  { name: 'Anjuna Beach', city: 'Goa', state: 'Goa', lat: 15.5796, lng: 73.7433, kind: 'Landmark' },
  { name: 'Baga Beach', city: 'Goa', state: 'Goa', lat: 15.5554, lng: 73.7515, kind: 'Landmark' },
  { name: 'Panjim Market', city: 'Goa', state: 'Goa', lat: 15.4978, lng: 73.8284, kind: 'Area' },
  { name: 'Fort Kochi', city: 'Kochi', state: 'Kerala', lat: 9.966, lng: 76.2426, kind: 'Landmark' },
  { name: 'Marine Drive Kochi', city: 'Kochi', state: 'Kerala', lat: 9.9765, lng: 76.2769, kind: 'Street' },
  { name: 'Kakkanad', city: 'Kochi', state: 'Kerala', lat: 10.0144, lng: 76.3392, kind: 'Area' },
  { name: 'Sector 17', city: 'Chandigarh', state: 'Chandigarh', lat: 30.7423, lng: 76.7867, kind: 'Area' },
  { name: 'Elante Mall', city: 'Chandigarh', state: 'Chandigarh', lat: 30.7069, lng: 76.8001, kind: 'Landmark' },
  { name: 'Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8549, lng: 80.9453, kind: 'Area' },
  { name: 'Gomti Nagar', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8547, lng: 81.0026, kind: 'Area' },
  { name: 'Rajajipuram', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8319, lng: 80.8903, kind: 'Area' },
  { name: 'Vijay Nagar', city: 'Indore', state: 'Madhya Pradesh', lat: 22.7536, lng: 75.8936, kind: 'Area' },
  { name: 'MG Road Indore', city: 'Indore', state: 'Madhya Pradesh', lat: 22.7206, lng: 75.8643, kind: 'Street' },
  { name: 'Palasia', city: 'Indore', state: 'Madhya Pradesh', lat: 22.7217, lng: 75.8854, kind: 'Area' },
  { name: 'Adajan', city: 'Surat', state: 'Gujarat', lat: 21.1931, lng: 72.7905, kind: 'Area' },
  { name: 'Vesu', city: 'Surat', state: 'Gujarat', lat: 21.1262, lng: 72.7719, kind: 'Area' },
  { name: 'Sitabuldi', city: 'Nagpur', state: 'Maharashtra', lat: 21.1505, lng: 79.0864, kind: 'Area' },
  { name: 'Dharampeth', city: 'Nagpur', state: 'Maharashtra', lat: 21.1325, lng: 79.0554, kind: 'Area' },
  { name: 'Gangtok MG Marg', city: 'Gangtok', state: 'Sikkim', lat: 27.3314, lng: 88.6137, kind: 'Street' },
  { name: 'Lake View Road', city: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.6843, kind: 'Street' },
  { name: 'Hathi Pol', city: 'Udaipur', state: 'Rajasthan', lat: 24.5841, lng: 73.7146, kind: 'Area' },
  { name: 'Sardar Patel Marg', city: 'Allahabad', state: 'Uttar Pradesh', lat: 25.4528, lng: 81.8477, kind: 'Street' },
  { name: 'Civil Lines Prayagraj', city: 'Prayagraj', state: 'Uttar Pradesh', lat: 25.4504, lng: 81.8388, kind: 'Area' },
  { name: 'Frazer Road', city: 'Patna', state: 'Bihar', lat: 25.609, lng: 85.1365, kind: 'Street' },
  { name: 'Boring Road', city: 'Patna', state: 'Bihar', lat: 25.6021, lng: 85.1239, kind: 'Street' },
  { name: 'Bistupur', city: 'Jamshedpur', state: 'Jharkhand', lat: 22.7906, lng: 86.1818, kind: 'Area' },
  { name: 'Gandhi Maidan', city: 'Patna', state: 'Bihar', lat: 25.6098, lng: 85.1439, kind: 'Landmark' },
  { name: 'Mahatma Gandhi Road', city: 'Ranchi', state: 'Jharkhand', lat: 23.3565, lng: 85.3255, kind: 'Street' },
  { name: 'Ratu Road', city: 'Ranchi', state: 'Jharkhand', lat: 23.379, lng: 85.3092, kind: 'Street' },
  { name: 'Janpath', city: 'Bhubaneswar', state: 'Odisha', lat: 20.2649, lng: 85.8367, kind: 'Street' },
  { name: 'Ashok Nagar', city: 'Bhubaneswar', state: 'Odisha', lat: 20.2917, lng: 85.855, kind: 'Area' },
  { name: 'G.S. Road', city: 'Guwahati', state: 'Assam', lat: 26.1849, lng: 91.7534, kind: 'Street' },
  { name: 'Paltan Bazar', city: 'Guwahati', state: 'Assam', lat: 26.1828, lng: 91.7482, kind: 'Area' },
  { name: 'Beach Road', city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.7161, lng: 83.3222, kind: 'Street' },
  { name: 'Dwaraka Nagar', city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.7231, lng: 83.3048, kind: 'Area' },
  { name: 'MG Road Thiruvananthapuram', city: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5085, lng: 76.9518, kind: 'Street' },
  { name: 'Kowdiar', city: 'Thiruvananthapuram', state: 'Kerala', lat: 8.528, lng: 76.959, kind: 'Area' },
  { name: 'GB Road', city: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lng: 81.6296, kind: 'Street' },
  { name: 'Shankar Nagar', city: 'Raipur', state: 'Chhattisgarh', lat: 21.2446, lng: 81.6515, kind: 'Area' },
  { name: 'Lawrence Road', city: 'Amritsar', state: 'Punjab', lat: 31.6274, lng: 74.8741, kind: 'Street' },
  { name: 'Ranjit Avenue', city: 'Amritsar', state: 'Punjab', lat: 31.6546, lng: 74.8598, kind: 'Area' },
  { name: 'Model Town', city: 'Ludhiana', state: 'Punjab', lat: 30.904, lng: 75.8386, kind: 'Area' },
  { name: 'Ferozepur Road', city: 'Ludhiana', state: 'Punjab', lat: 30.8902, lng: 75.8429, kind: 'Street' },
  { name: 'College Road', city: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898, kind: 'Street' },
  { name: 'Gangapur Road', city: 'Nashik', state: 'Maharashtra', lat: 19.9846, lng: 73.7934, kind: 'Street' },
  { name: 'CIDCO', city: 'Aurangabad', state: 'Maharashtra', lat: 19.8851, lng: 75.3417, kind: 'Area' },
  { name: 'Rajendra Prasad Road', city: 'Dehradun', state: 'Uttarakhand', lat: 30.3255, lng: 78.0449, kind: 'Street' },
  { name: 'Rajpur Road', city: 'Dehradun', state: 'Uttarakhand', lat: 30.3447, lng: 78.0481, kind: 'Street' },
  { name: 'Mall Road Shimla', city: 'Shimla', state: 'Himachal Pradesh', lat: 31.1044, lng: 77.1736, kind: 'Street' },
  { name: 'Sojha Road', city: 'Shimla', state: 'Himachal Pradesh', lat: 31.1096, lng: 77.169, kind: 'Street' },
  { name: 'Sojati Gate', city: 'Jodhpur', state: 'Rajasthan', lat: 26.293, lng: 73.0247, kind: 'Area' },
  { name: 'Sardarpura', city: 'Jodhpur', state: 'Rajasthan', lat: 26.2777, lng: 73.0411, kind: 'Area' },
  { name: 'Godowlia', city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3109, lng: 83.0105, kind: 'Area' },
  { name: 'Lahurabir', city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3205, lng: 83.0042, kind: 'Area' },
  { name: 'Sadar Bazar', city: 'Agra', state: 'Uttar Pradesh', lat: 27.1885, lng: 78.0311, kind: 'Area' },
  { name: 'Kamla Nagar', city: 'Agra', state: 'Uttar Pradesh', lat: 27.2161, lng: 78.0038, kind: 'Area' },
  { name: 'Arera Colony', city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2186, lng: 77.4119, kind: 'Area' },
  { name: 'MP Nagar', city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2209, lng: 77.4317, kind: 'Area' },
  { name: 'Lashkar', city: 'Gwalior', state: 'Madhya Pradesh', lat: 26.2183, lng: 78.1828, kind: 'Area' },
  { name: 'Thatipur', city: 'Gwalior', state: 'Madhya Pradesh', lat: 26.2397, lng: 78.1796, kind: 'Area' },
  { name: 'Vijay Nagar Jabalpur', city: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.169, lng: 79.947, kind: 'Area' },
  { name: 'Wright Town', city: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.1766, lng: 79.9511, kind: 'Area' },
  { name: 'Bhanwar Kuan', city: 'Indore', state: 'Madhya Pradesh', lat: 22.7155, lng: 75.8764, kind: 'Landmark' },
  { name: 'Smart City', city: 'Kota', state: 'Rajasthan', lat: 25.1423, lng: 75.8437, kind: 'Area' },
  { name: 'Mahaveer Nagar', city: 'Kota', state: 'Rajasthan', lat: 25.1797, lng: 75.8355, kind: 'Area' },
  { name: 'Kalupur', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0306, lng: 72.6011, kind: 'Area' },
  { name: 'Gondal Road', city: 'Rajkot', state: 'Gujarat', lat: 22.2687, lng: 70.8061, kind: 'Street' },
  { name: 'Race Course Ring Road', city: 'Rajkot', state: 'Gujarat', lat: 22.2974, lng: 70.7934, kind: 'Street' },
  { name: 'Alkapuri', city: 'Vadodara', state: 'Gujarat', lat: 22.3082, lng: 73.17, kind: 'Area' },
  { name: 'Fatehgunj', city: 'Vadodara', state: 'Gujarat', lat: 22.3158, lng: 73.1905, kind: 'Area' },
  { name: 'Gandhi Bazaar', city: 'Mysuru', state: 'Karnataka', lat: 12.3163, lng: 76.6533, kind: 'Area' },
  { name: 'Vijayanagar', city: 'Mysuru', state: 'Karnataka', lat: 12.3489, lng: 76.6071, kind: 'Area' },
  { name: 'RS Puram', city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0128, lng: 76.9526, kind: 'Area' },
  { name: 'Gandhipuram', city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0219, lng: 76.971, kind: 'Area' },
  { name: 'Kacheri Road', city: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198, kind: 'Street' },
  { name: 'Anna Nagar Madurai', city: 'Madurai', state: 'Tamil Nadu', lat: 9.9377, lng: 78.1087, kind: 'Area' },
  { name: 'Adayar Gate', city: 'Puducherry', state: 'Puducherry', lat: 11.9294, lng: 79.8273, kind: 'Area' },
  { name: 'Rock Beach', city: 'Puducherry', state: 'Puducherry', lat: 11.9329, lng: 79.835, kind: 'Landmark' },
  { name: 'Old Goa Church', city: 'Goa', state: 'Goa', lat: 15.5034, lng: 73.9118, kind: 'Landmark' },
  { name: 'Candolim Beach', city: 'Goa', state: 'Goa', lat: 15.5125, lng: 73.7635, kind: 'Landmark' },
  { name: 'Calangute Beach', city: 'Goa', state: 'Goa', lat: 15.5439, lng: 73.7553, kind: 'Landmark' },
  { name: 'Morjim Beach', city: 'Goa', state: 'Goa', lat: 15.6303, lng: 73.7371, kind: 'Landmark' },
  { name: 'Arambol Beach', city: 'Goa', state: 'Goa', lat: 15.6836, lng: 73.7037, kind: 'Landmark' },
  { name: 'Sernabatim Beach', city: 'Goa', state: 'Goa', lat: 15.2392, lng: 73.9122, kind: 'Landmark' },
];

// Straight-line distance in km (haversine). Used to rank typed suggestions
// nearest-first once the GPS fix is known.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Demo center while GPS has not answered yet (real position takes over once granted).
const DEMO_CENTER = { latitude: 18.5204, longitude: 73.8567 };

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser } = useAuth();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nearestCity, setNearestCity] = useState<{ name: string; state: string } | null>(null);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: DEMO_CENTER.latitude,
    lng: DEMO_CENTER.longitude,
    zoom: 12,
  });

  // Live map results from OpenStreetMap Nominatim geocoding - real streets,
  // areas and landmarks from map data, bounded to the box around the GPS fix
  // so suggestions are always near the user. Offline / error falls back to
  // the local DB only.
  interface LivePlace {
    name: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    kind: string;
    display_name: string;
  }
  const [livePlaces, setLivePlaces] = useState<LivePlace[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLivePlaces([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q,
        )}&format=jsonv2&addressdetails=1&limit=8&countrycodes=in&dedupe=1`;
        if (userLoc) {
          const d = 0.15; // ~16km box around the user
          url += `&viewbox=${userLoc.longitude - d},${userLoc.latitude - d},${userLoc.longitude + d},${
            userLoc.latitude + d
          }&bounded=1`;
        }
        const res = await fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'susej-marketplace-demo/1.0' },
        });
        if (!res.ok) throw new Error(`nominatim ${res.status}`);
        const data: {
          lat: string;
          lon: string;
          type: string;
          name?: string;
          display_name: string;
          address?: Record<string, string>;
        }[] = await res.json();
        setLivePlaces(
          data
            .map((r) => {
              const a = r.address ?? {};
              const name =
                a.road ||
                a.neighbourhood ||
                a.suburb ||
                a.quarter ||
                a.city_district ||
                a.town ||
                a.city ||
                a.village ||
                a.county ||
                a.state ||
                r.name ||
                '';
              const city = a.city || a.town || a.village || a.county || '';
              const kind = a.road
                ? 'Street'
                : a.neighbourhood || a.suburb || a.quarter || a.city_district
                  ? 'Area'
                  : r.type === 'tourism' || r.type === 'amenity'
                    ? 'Landmark'
                    : 'Place';
              return { name, city, state: a.state || '', lat: parseFloat(r.lat), lng: parseFloat(r.lon), kind, display_name: r.display_name };
            })
            .filter((p) => p.name),
        );
      } catch {
        setLivePlaces([]); // offline - local DB suggestions still apply
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, userLoc]);

  // Typed suggestions: live map results (Nominatim) first - real streets,
  // areas and landmarks near the user as they type - then matching cities,
  // streets, areas and landmarks from the local DB, nearest-first once the
  // GPS fix is known. The list is topped up with nearby places so it never
  // looks selective.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const cityRows = CITY_DB.map((c) => ({ ...c, kind: 'City' as const, city: c.name }));
    const pool = [...cityRows, ...PLACES_DB];
    const matches = pool.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q),
    );
    const rank = (a: (typeof pool)[number], b: (typeof pool)[number]) =>
      userLoc
        ? distanceKm(userLoc.latitude, userLoc.longitude, a.lat, a.lng) -
          distanceKm(userLoc.latitude, userLoc.longitude, b.lat, b.lng)
        : a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    matches.sort(rank);
    const out: (typeof pool)[number][] = [];
    const seen = new Set<string>();
    for (const p of livePlaces) {
      const key = `${p.name.toLowerCase()}|${p.kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p as (typeof pool)[number]);
      }
    }
    for (const m of matches) {
      const key = `${m.name.toLowerCase()}|${m.kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m);
      }
    }
    // No live results and nothing matched -> nearest places when GPS is on.
    if (out.length === 0 && userLoc) {
      for (const p of [...pool].sort(rank)) {
        if (out.length >= 10) break;
        out.push(p);
      }
    }
    // Few results -> top up with nearby places from the first result's city.
    if (out.length < 10 && out[0]) {
      const homeCity = out[0].city || out[0].name;
      const fillers = pool
        .filter((c) => c.city === homeCity && !seen.has(`${c.name.toLowerCase()}|${c.kind}`))
        .sort(rank);
      for (const f of fillers) {
        if (out.length >= 10) break;
        out.push(f);
      }
    }
    return out.slice(0, 10);
  }, [query, userLoc, livePlaces]);

  const pickSuggestion = useCallback((name: string, city: string, kind: string) => {
    const label = kind === 'City' ? name : city ? `${name}, ${city}` : `${name}`;
    setSelectedCity(label);
    setQuery(label);
  }, []);

  const applyGpsFix = useCallback((lat: number, lng: number) => {
    setUserLoc({ latitude: lat, longitude: lng });
    setCenterTarget({ lat, lng, zoom: 14 });
    let nearest: { name: string; state: string } | null = null;
    let best = Infinity;
    for (const c of CITY_DB) {
      const d = distanceKm(lat, lng, c.lat, c.lng);
      if (d < best) {
        best = d;
        nearest = { name: c.name, state: c.state };
      }
    }
    setNearestCity(nearest);
  }, []);

  const detectLocation = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        return false;
      }
      setLocDenied(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      applyGpsFix(pos.coords.latitude, pos.coords.longitude);
      return true;
    } catch {
      setLocDenied(true);
      return false;
    }
  }, [applyGpsFix]);

  // Pre-granted permission (e.g. the user already allowed location on the map
  // screen) -> center straight on the real position without asking again.
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          applyGpsFix(pos.coords.latitude, pos.coords.longitude);
        } catch {
          // GPS not ready yet - keep the demo center
        }
      }
    })();
  }, [applyGpsFix]);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between h-[62px] px-5"
        style={{ backgroundColor: colors.surface, height: 62 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        {/* Step indicators - 4 of 6 */}
        <View className="flex-row gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: i < 5 ? colors.primaryContainer : 'rgba(26,26,46,0.08)' }}
            />
          ))}
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" bounces={false} showsVerticalScrollIndicator={false}>
        {/* Map / Hero Section - real Leaflet map, centered on the user's GPS
            position once location is granted (falls back to the demo center). */}
        <View className="w-full h-[240px]" style={{ backgroundColor: '#efecff' }}>
          <LeafletMapHost
            style={{ flex: 1 }}
            markers={userLoc ? [{ id: 'user', lat: userLoc.latitude, lng: userLoc.longitude, kind: 'user' }] : []}
            center={centerTarget}
          />
          {locDenied && (
            <TouchableOpacity
              className="absolute left-3 bottom-3 flex-row items-center px-3 py-1.5 rounded-figma-full"
              style={{ backgroundColor: 'rgba(26,26,46,0.75)' }}
              onPress={() => detectLocation()}
            >
              <GpsTargetIcon size={13} color="#FFFFFF" />
              <Text className="font-inter-500 ml-1.5" style={{ fontSize: 11, color: '#FFFFFF' }}>
                Location off — tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content Area */}
        <View className="px-5 pt-8">
          {/* Heading */}
          <Text
            className="font-inter-700 text-center mb-2"
            style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.48, color: colors.textPrimary }}
          >
            Where are you?
          </Text>
          <Text
            className="font-inter-400 text-center mb-8"
            style={{ fontSize: 14, lineHeight: 20, color: '#767586' }}
          >
            Discover items and friends in your{'\n'}neighborhood. We only use your location{'\n'}to show local feeds.
          </Text>

          {/* Allow Location Access Button - requests real GPS, centers the map
              on the detected position and stays here so the user can confirm
              the detected chip, type for live map suggestions or continue. */}
          <TouchableOpacity
            className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-8"
            style={{ backgroundColor: colors.primary }}
            onPress={() => detectLocation()}
          >
            <GpsTargetIcon size={18} color="#FFFFFF" />
            <Text
              className="font-inter-600 ml-2"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
            >
              Allow Location Access
            </Text>
          </TouchableOpacity>

          {/* Divider with OR */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-[1px]" style={{ backgroundColor: '#dcdae0' }} />
            <Text
              className="font-inter-500 mx-4"
              style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: '#c7c4d7' }}
            >
              OR
            </Text>
            <View className="flex-1 h-[1px]" style={{ backgroundColor: '#dcdae0' }} />
          </View>

          {/* Search Bar - typing suggests location names, nearest-first when GPS is on */}
          <View
            className="flex-row items-center h-14 px-4 rounded-figma-16 mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          >
            <SearchIcon size={16} color="#767586" />
            <TextInput
              className="flex-1 ml-3 font-inter-400 h-full"
              style={{ fontSize: 16, color: colors.textPrimary }}
              placeholder="Select City Manually"
              placeholderTextColor="rgba(118,117,134,0.6)"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {/* Live suggestions - cities, streets, areas and landmarks */}
          {suggestions.length > 0 && !(selectedCity && query === selectedCity) && (
            <View
              className="mb-5 rounded-figma-16 overflow-hidden"
              style={{ backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: '#dcdae0' }}
            >
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={s.kind + s.name}
                  className="flex-row items-center px-4"
                  style={{
                    height: 52,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: '#efecff',
                    backgroundColor:
                      selectedCity === (s.kind === 'City' ? s.name : `${s.name}, ${s.city}`)
                        ? 'rgba(93,95,239,0.08)'
                        : 'transparent',
                  }}
                  onPress={() => pickSuggestion(s.name, s.city, s.kind)}
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#efecff' }}
                  >
                    <SearchIcon size={13} color="#5d5fef" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-inter-500"
                      style={{ fontSize: 15, color: colors.textPrimary }}
                    >
                      {s.name}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="font-inter-400" style={{ fontSize: 11, color: '#767586' }}>
                        {s.kind} · {s.kind === 'City' ? s.state : s.city}
                      </Text>
                      {'display_name' in s && (
                        <Text
                          className="font-inter-600 ml-1.5 px-1 rounded-sm overflow-hidden"
                          style={{ fontSize: 9, color: colors.primary, backgroundColor: 'rgba(93,95,239,0.1)' }}
                        >
                          MAP
                        </Text>
                      )}
                    </View>
                  </View>
                  {userLoc && (
                    <Text className="font-inter-400" style={{ fontSize: 11, color: '#767586' }}>
                      {Math.round(distanceKm(userLoc.latitude, userLoc.longitude, s.lat, s.lng))} km
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Detected city from GPS */}
          {nearestCity && (
            <TouchableOpacity
              className="flex-row items-center h-14 px-4 rounded-figma-16 mb-4"
              style={{
                backgroundColor: selectedCity === nearestCity.name ? 'rgba(93,95,239,0.08)' : '#f0eeff',
                borderWidth: 1,
                borderColor: selectedCity === nearestCity.name ? 'transparent' : '#c7c4d7',
              }}
              onPress={() => {
                setSelectedCity(nearestCity.name);
                setQuery(nearestCity.name);
              }}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary }}
              >
                <GpsTargetIcon size={18} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter-500"
                  style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.primary }}
                >
                  DETECTED FROM YOUR LOCATION
                </Text>
                <Text
                  className="font-inter-600"
                  style={{ fontSize: 16, lineHeight: 22, color: colors.textPrimary }}
                >
                  {nearestCity.name} · {nearestCity.state}
                </Text>
              </View>
              {selectedCity === nearestCity.name && (
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Popular Cities */}
          <Text
            className="font-inter-500 mb-3"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textSecondary }}
          >
            Popular Cities
          </Text>

          <View className="gap-3 pb-4">
            {cities.map((city) => (
              <TouchableOpacity
                key={city.name}
                className="flex-row items-center h-14 px-4 rounded-figma-16"
                style={{
                  backgroundColor: selectedCity === city.name ? 'rgba(93,95,239,0.08)' : colors.surfaceContainerLowest,
                  borderWidth: 1,
                  borderColor: selectedCity === city.name ? 'transparent' : '#dcdae0',
                }}
                onPress={() => setSelectedCity(city.name)}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#efecff' }}
                >
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: '#5d5fef' }}>
                    <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '600' }}>
                      {city.name[0]}
                    </Text>
                  </View>
                </View>
                <Text
                  className="flex-1 font-inter-400"
                  style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}
                >
                  {city.name}
                </Text>
                {selectedCity === city.name && (
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="px-5 pt-4 pb-8" style={{ backgroundColor: colors.surface, paddingBottom: insets.bottom + 32 }}>
        <TouchableOpacity
          className="w-full h-14 items-center justify-center rounded-figma-16 mb-3"
          style={{ backgroundColor: colors.primary }}
          onPress={() => {
            updateUser({ location: selectedCity ?? nearestCity?.name ?? '' });
            router.push('/(onboarding)/profile-setup');
          }}
        >
          <Text
            className="font-inter-600"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
          >
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center"
          onPress={() => router.push('/(onboarding)/profile-setup')}
        >
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
