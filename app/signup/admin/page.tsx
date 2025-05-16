"use client"

import AdminSignUpForm from "@/components/auth/signup/admin-signup-form"
import { motion } from "framer-motion"
import Image from "next/image"

export default function AdminSignUp() {
  return (
    <div className="flex min-h-screen dark:bg-gray-900">
      <div className="hidden md:block md:w-1/2 bg-cover bg-center relative overflow-hidden">
        <Image
          src="/images/admin-signup.png"
          alt="Admin signup background"
          fill
          className="object-cover"
          priority
        />

        <div className="absolute inset-0 bg-muted-foreground/70 backdrop-blur-sm"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-md"
          >
            <Image
              src="/images/logo.png"
              alt="iRankHub Logo"
              width={120}
              height={120}
              className="mx-auto mb-6"
            />
            <h2 className="text-3xl font-bold text-primary-foreground dark:text-white mb-4">
              Manage the iRankHub Platform
            </h2>

            <div className="space-y-4 text-left">
              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-lg shadow">
                <h3 className="font-medium text-primary mb-2">Why join as an Admin?</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2 pl-5 list-disc">
                  <li>Manage the entire platform</li>
                  <li>Configure tournaments and leagues</li>
                  <li>Generate comprehensive reports</li>
                </ul>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-lg shadow flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  A
                </div>
                <div>
                  <h3 className="font-medium text-primary">
                    Admin Account
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    For platform administrators
                  </p>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  &#34;Help build and maintain the platform that connects debaters worldwide. Your role is crucial in creating educational opportunities.&#34;
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <AdminSignUpForm />
        </motion.div>
      </div>
    </div>
  )
}