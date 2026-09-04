import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { getAuth } from "firebase/auth";
import app from "../firebase";

export const auth = getAuth(app);

export const registerUser = async (email, password) => {
  const result = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  return result.user;
};

export const loginUser = async (email, password) => {

  const result = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return result.user;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const observeAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};