import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

import {
  auth,
  db,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  formatAuthError,
  sanitizeForFirestore,
} from '../lib/firebase';

import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isFirebaseReady: boolean;

  accountType: 'citizen' | 'authority';

  setAccountType: (
    type: 'citizen' | 'authority'
  ) => void;

  loginWithEmail: (
    email: string,
    pass: string
  ) => Promise<void>;

  signUpWithEmail: (
    name: string,
    email: string,
    pass: string,
    role?: 'citizen' | 'municipal_officer'
  ) => Promise<void>;

  signInWithGoogle: () => Promise<void>;

  logout: () => Promise<void>;

  resetPassword: (
    email: string
  ) => Promise<void>;

  resendVerificationEmail: () => Promise<void>;

  updateUserProfileData: (
    newName: string,
    photoURL?: string
  ) => Promise<void>;

  authModalOpen: boolean;

  authModalMode:
    | 'login'
    | 'signup'
    | 'forgot';

  openAuthModal: (
    mode?: 'login' | 'signup' | 'forgot',
    targetAccount?: 'citizen' | 'authority'
  ) => void;

  closeAuthModal: () => void;

  toastMessage: {
    text: string;
    type: 'success' | 'error' | 'info';
  } | null;

  showToast: (
    text: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

/* -------------------------------------------------------
   Convert Firebase user + Firestore profile
------------------------------------------------------- */

function profileFromFirebaseUser(
  fbUser: any,
  data: Record<string, any> = {}
): UserProfile {
  return {
    uid: fbUser.uid,

    email:
      fbUser.email || '',

    displayName:
      fbUser.displayName ||
      data.displayName ||
      fbUser.email?.split('@')[0] ||
      'Citizen',

    photoURL:
      fbUser.photoURL ||
      data.photoURL ||
      '',

    role:
      data.role ||
      'citizen',

    createdAt:
      data.createdAt ||
      fbUser.metadata?.creationTime ||
      new Date().toISOString(),

    reportsCount:
      Number(data.reportsCount || 0),

    verifiedRepairsCount:
      Number(
        data.verifiedRepairsCount || 0
      ),

    emailVerified:
      fbUser.emailVerified,
  };
}

/* -------------------------------------------------------
   Check whether Firestore profile is an authority
------------------------------------------------------- */

function isAuthorityRole(
  role: unknown
): boolean {
  return (
    role === 'authority' ||
    role === 'municipal_officer' ||
    role === 'admin'
  );
}

/* -------------------------------------------------------
   AUTH PROVIDER
------------------------------------------------------- */

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] =
    useState<UserProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [authModalOpen, setAuthModalOpen] =
    useState(false);

  const [authModalMode, setAuthModalMode] =
    useState<
      'login' | 'signup' | 'forgot'
    >('login');

  const [accountType, setAccountType] =
    useState<
      'citizen' | 'authority'
    >('citizen');

  const [toastMessage, setToastMessage] =
    useState<{
      text: string;
      type:
        | 'success'
        | 'error'
        | 'info';
    } | null>(null);

  /* -------------------------------------------------------
     Toast
  ------------------------------------------------------- */

  const showToast = (
    text: string,
    type:
      | 'success'
      | 'error'
      | 'info' = 'info'
  ) => {
    setToastMessage({
      text,
      type,
    });

    setTimeout(() => {
      setToastMessage(current =>
        current?.text === text
          ? null
          : current
      );
    }, 4500);
  };

  /* -------------------------------------------------------
     Firebase auth state
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      !isFirebaseConfigured ||
      (!auth?.currentUser && !auth)
    ) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(
      auth,
      async fbUser => {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        /*
         * Firebase Auth is the source of truth
         * for the active session.
         */

        const fallbackProfile =
          profileFromFirebaseUser(
            fbUser
          );

        setUser(fallbackProfile);
        setLoading(false);

        try {
          const ref = doc(
            db,
            'users',
            fbUser.uid
          );

          const snap =
            await getDoc(ref);

          if (snap.exists()) {
            setUser(
              profileFromFirebaseUser(
                fbUser,
                snap.data()
              )
            );
          } else {
            await setDoc(
              ref,
              sanitizeForFirestore(
                fallbackProfile
              )
            );

            setUser(
              fallbackProfile
            );
          }
        } catch (error) {
          console.error(
            'Auth profile sync failed; Firebase session retained:',
            error
          );

          showToast(
            'Signed in. Profile data will sync when the connection is available.',
            'info'
          );
        }
      }
    );
  }, []);

  /* -------------------------------------------------------
     EMAIL LOGIN
  ------------------------------------------------------- */

  const loginWithEmail = async (
    email: string,
    pass: string
  ) => {
    if (!auth) {
      throw new Error(
        'Firebase Auth is not initialized.'
      );
    }

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          pass
        );

      /*
       * If Authority mode is selected,
       * verify the Firestore role before
       * allowing access.
       */

      if (accountType === 'authority') {
        const ref = doc(
          db,
          'users',
          credential.user.uid
        );

        const snap =
          await getDoc(ref);

        if (!snap.exists()) {
          await firebaseSignOut(auth);

          const message =
            'This account is not registered as a municipal authority account.';

          showToast(
            message,
            'error'
          );

          throw new Error(message);
        }

        const data = snap.data();

        if (
          !isAuthorityRole(
            data.role
          )
        ) {
          await firebaseSignOut(auth);

          const message =
            'This account is not authorized for the Municipal Authority portal.';

          showToast(
            message,
            'error'
          );

          throw new Error(message);
        }
      }

      setAuthModalOpen(false);

      showToast(
        accountType === 'authority'
          ? 'Municipal authority logged in successfully.'
          : 'Logged in successfully.',
        'success'
      );
    } catch (err) {
      const message =
        err instanceof Error &&
        err.message.includes(
          'not registered'
        )
          ? err.message
          : err instanceof Error &&
            err.message.includes(
              'not authorized'
            )
          ? err.message
          : formatAuthError(err);

      showToast(
        message,
        'error'
      );

      throw new Error(message);
    }
  };

  /* -------------------------------------------------------
     EMAIL SIGN UP
  ------------------------------------------------------- */

  const signUpWithEmail = async (
    name: string,
    email: string,
    pass: string,
    role:
      | 'citizen'
      | 'municipal_officer' = 'citizen'
  ) => {
    if (!auth) {
      throw new Error(
        'Firebase Auth is not initialized.'
      );
    }

    /*
     * Authority accounts are NOT publicly
     * created through this form.
     *
     * They must be provisioned by an admin.
     */

    if (role !== 'citizen') {
      const message =
        'Municipal authority accounts are provisioned by the system administrator.';

      showToast(
        message,
        'error'
      );

      throw new Error(message);
    }

    try {
      const cred =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          pass
        );

      await updateProfile(
        cred.user,
        {
          displayName:
            name.trim(),
        }
      );

      const profile: UserProfile = {
        uid: cred.user.uid,

        email:
          cred.user.email ||
          email.trim(),

        displayName:
          name.trim(),

        photoURL:
          cred.user.photoURL ||
          '',

        role: 'citizen',

        createdAt:
          new Date().toISOString(),

        reportsCount: 0,

        verifiedRepairsCount: 0,

        emailVerified:
          cred.user.emailVerified,
      };

      setUser(profile);

      setAuthModalOpen(false);

      showToast(
        'Citizen account created.',
        'success'
      );

      try {
        await setDoc(
          doc(
            db,
            'users',
            cred.user.uid
          ),
          sanitizeForFirestore(
            profile
          )
        );
      } catch (profileError) {
        console.error(
          'New account profile sync failed:',
          profileError
        );

        showToast(
          'Account created. Your profile will finish syncing shortly.',
          'info'
        );
      }

      try {
        await sendEmailVerification(
          cred.user
        );

        showToast(
          'Verification email sent.',
          'success'
        );
      } catch (
        verificationError
      ) {
        console.warn(
          'Verification email could not be sent:',
          verificationError
        );
      }
    } catch (err) {
      const message =
        formatAuthError(err);

      showToast(
        message,
        'error'
      );

      throw new Error(message);
    }
  };

  /* -------------------------------------------------------
     GOOGLE LOGIN
     
     Works for BOTH Citizen and Authority.
     
     Citizen:
       - New Google account → citizen
       - Existing account → existing role

     Authority:
       - Existing authorized authority → allowed
       - Normal Google account → rejected
       - Unknown Google account → rejected
  ------------------------------------------------------- */

  const signInWithGoogle =
    async () => {
      if (!auth) {
        throw new Error(
          'Firebase Auth is not initialized.'
        );
      }

      try {
        const provider =
          new GoogleAuthProvider();

        provider.setCustomParameters({
          prompt: 'select_account',
        });

        const result =
          await signInWithPopup(
            auth,
            provider
          );

        const firebaseUser =
          result.user;

        const ref = doc(
          db,
          'users',
          firebaseUser.uid
        );

        const snap =
          await getDoc(ref);

        /* -----------------------------------------------
           AUTHORITY GOOGLE LOGIN
        ------------------------------------------------ */

        if (
          accountType ===
          'authority'
        ) {
          /*
           * Authority accounts MUST already
           * exist in Firestore.
           */

          if (!snap.exists()) {
            await firebaseSignOut(
              auth
            );

            const message =
              'This Google account is not registered as a municipal authority account. Please use your authorized authority account.';

            showToast(
              message,
              'error'
            );

            throw new Error(
              message
            );
          }

          const data =
            snap.data();

          /*
           * Check actual authority role.
           */

          if (
            !isAuthorityRole(
              data.role
            )
          ) {
            await firebaseSignOut(
              auth
            );

            const message =
              'This Google account is not authorized for the Municipal Authority portal.';

            showToast(
              message,
              'error'
            );

            throw new Error(
              message
            );
          }

          /*
           * Authorized authority.
           */

          const authorityProfile =
            profileFromFirebaseUser(
              firebaseUser,
              data
            );

          setUser(
            authorityProfile
          );

          setAuthModalOpen(false);

          showToast(
            'Municipal authority signed in successfully.',
            'success'
          );

          return;
        }

        /* -----------------------------------------------
           CITIZEN GOOGLE LOGIN
        ------------------------------------------------ */

        if (snap.exists()) {
          /*
           * Existing citizen profile.
           */

          const citizenProfile =
            profileFromFirebaseUser(
              firebaseUser,
              snap.data()
            );

          setUser(
            citizenProfile
          );
        } else {
          /*
           * First-time Google citizen.
           */

          const citizenProfile =
            profileFromFirebaseUser(
              firebaseUser
            );

          await setDoc(
            ref,
            sanitizeForFirestore(
              citizenProfile
            )
          );

          setUser(
            citizenProfile
          );
        }

        setAuthModalOpen(false);

        showToast(
          'Signed in with Google.',
          'success'
        );
      } catch (err) {
        /*
         * Do not show duplicate errors
         * when we intentionally throw an
         * authorization message above.
         */

        const rawMessage =
          err instanceof Error
            ? err.message
            : '';

        const isCustomAuthError =
          rawMessage.includes(
            'not registered as a municipal'
          ) ||
          rawMessage.includes(
            'not authorized for the Municipal'
          );

        const message =
          isCustomAuthError
            ? rawMessage
            : formatAuthError(err);

        showToast(
          message,
          'error'
        );

        throw new Error(
          message
        );
      }
    };

  /* -------------------------------------------------------
     LOGOUT
  ------------------------------------------------------- */

  const logout = async () => {
    if (auth) {
      await firebaseSignOut(
        auth
      );
    }

    setUser(null);

    setAccountType(
      'citizen'
    );

    showToast(
      'Signed out.',
      'info'
    );
  };

  /* -------------------------------------------------------
     PASSWORD RESET
  ------------------------------------------------------- */

  const resetPassword = async (
    email: string
  ) => {
    if (!auth) {
      throw new Error(
        'Firebase Auth is not initialized.'
      );
    }

    try {
      await sendPasswordResetEmail(
        auth,
        email.trim()
      );

      setAuthModalOpen(false);

      showToast(
        `Password reset link sent to ${email.trim()}`,
        'success'
      );
    } catch (err) {
      const message =
        formatAuthError(err);

      showToast(
        message,
        'error'
      );

      throw new Error(message);
    }
  };

  /* -------------------------------------------------------
     RESEND EMAIL VERIFICATION
  ------------------------------------------------------- */

  const resendVerificationEmail =
    async () => {
      if (!auth?.currentUser)
        return;

      try {
        await sendEmailVerification(
          auth.currentUser
        );

        showToast(
          'Verification email sent.',
          'success'
        );
      } catch (err) {
        showToast(
          formatAuthError(err),
          'error'
        );
      }
    };

  /* -------------------------------------------------------
     UPDATE PROFILE
  ------------------------------------------------------- */

  const updateUserProfileData =
    async (
      newName: string,
      photoURL?: string
    ) => {
      if (
        !auth?.currentUser ||
        !user
      ) {
        return;
      }

      try {
        await updateProfile(
          auth.currentUser,
          {
            displayName:
              newName.trim(),

            ...(photoURL
              ? { photoURL }
              : {}),
          }
        );

        try {
          await updateDoc(
            doc(
              db,
              'users',
              user.uid
            ),
            {
              displayName:
                newName.trim(),

              ...(photoURL
                ? { photoURL }
                : {}),
            }
          );
        } catch (
          profileError
        ) {
          console.error(
            'Firestore profile update failed:',
            profileError
          );
        }

        setUser(
          prev =>
            prev
              ? {
                  ...prev,

                  displayName:
                    newName.trim(),

                  ...(photoURL
                    ? { photoURL }
                    : {}),
                }
              : null
        );

        showToast(
          'Profile updated successfully.',
          'success'
        );
      } catch (err) {
        showToast(
          formatAuthError(err),
          'error'
        );
      }
    };

  /* -------------------------------------------------------
     OPEN AUTH MODAL
  ------------------------------------------------------- */

  const openAuthModal = (
    mode:
      | 'login'
      | 'signup'
      | 'forgot' = 'login',

    targetAccount?:
      | 'citizen'
      | 'authority'
  ) => {
    setAuthModalMode(
      mode
    );

    if (targetAccount) {
      setAccountType(
        targetAccount
      );
    }

    setAuthModalOpen(
      true
    );
  };

  /* -------------------------------------------------------
     PROVIDER
  ------------------------------------------------------- */

  return (
    <AuthContext.Provider
      value={{
        user,

        loading,

        isFirebaseReady:
          isFirebaseConfigured,

        accountType,

        setAccountType,

        loginWithEmail,

        signUpWithEmail,

        signInWithGoogle,

        logout,

        resetPassword,

        resendVerificationEmail,

        updateUserProfileData,

        authModalOpen,

        authModalMode,

        openAuthModal,

        closeAuthModal: () =>
          setAuthModalOpen(false),

        toastMessage,

        showToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* -------------------------------------------------------
   HOOK
------------------------------------------------------- */

export function useAuth(): AuthContextType {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}
