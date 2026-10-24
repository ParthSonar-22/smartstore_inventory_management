import { initializeApp }  from 'firebase/app';
import { getFirestore }   from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyC_cE14kXTZLQrJqmW3sXq6u8swaPWr_p4',
  authDomain:        'smartstore-11be7.firebaseapp.com',
  projectId:         'smartstore-11be7',
  storageBucket:     'smartstore-11be7.firebasestorage.app',
  messagingSenderId: '138869815193',
  appId:             '1:138869815193:web:481b58cb262a73069d0508',
};

const app           = initializeApp(firebaseConfig);
export const db     = getFirestore(app);
export const auth   = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

