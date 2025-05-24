"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Calendar, Shield, Users, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <Link href="#" onClick={() => window.history.back()}>
              <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={32}
                height={32}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Terms and Conditions
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8"
        >
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-8">
            <Calendar className="h-4 w-4" />
            <span>Last updated: May 2025</span>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Welcome to iRankHub
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              These Terms and Conditions (&#34;Terms&#34;) govern your use of iRankHub, a comprehensive platform for debate tournaments and educational competitions. By accessing or using our platform, you agree to be bound by these Terms.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Privacy & Safety</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We protect your personal information and ensure a safe learning environment for all users.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Fair Use</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All users must engage respectfully and follow our community guidelines.
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Global Access</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our platform connects debaters worldwide while complying with local regulations.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                1. Acceptance of Terms
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                By creating an account or using iRankHub, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you may not use our platform.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                2. User Accounts and Eligibility
              </h3>
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
                <p>To use iRankHub, you must:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Be at least 13 years old (or the minimum age in your jurisdiction)</li>
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Be affiliated with a recognized educational institution (for students and school admins)</li>
                  <li>Have appropriate qualifications and safeguarding certifications (for volunteers/judges)</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                3. User Roles and Responsibilities
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Students</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                    <li>Participate respectfully in debates and tournaments</li>
                    <li>Follow academic integrity guidelines</li>
                    <li>Respect judges, fellow students, and platform rules</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">School Administrators</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                    <li>Ensure accurate school information and student eligibility</li>
                    <li>Supervise student participation and conduct</li>
                    <li>Handle payments and administrative responsibilities</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Volunteers/Judges</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                    <li>Maintain impartiality and fairness in judging</li>
                    <li>Provide constructive feedback to students</li>
                    <li>Complete required safeguarding certifications and other certifications where applicable</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                4. Privacy and Data Protection
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We are committed to protecting your privacy. Our Privacy Policy, which forms part of these Terms, explains how we collect, use, and protect your personal information. We comply with applicable data protection laws, including GDPR where applicable.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Special Note for Minors:</strong> If you are under 18, your parent or guardian must review and agree to these Terms on your behalf.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                5. Prohibited Conduct
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                The following activities are strictly prohibited:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
                <li>Harassment, bullying, or inappropriate behavior toward other users</li>
                <li>Sharing false or misleading information</li>
                <li>Attempting to gain unauthorized access to other accounts or system features</li>
                <li>Using the platform for commercial purposes without authorization</li>
                <li>Violating intellectual property rights</li>
                <li>Engaging in activities that disrupt platform operations</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                6. Content and Intellectual Property
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You retain ownership of content you create on the platform. However, by using iRankHub, you grant us a license to use, display, and distribute your content as necessary to provide our services. We respect intellectual property rights and expect users to do the same.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                7. Payment Terms
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Tournament fees and other charges are clearly displayed before you commit to payment. All fees are non-refundable unless explicitly stated otherwise. We reserve the right to modify pricing with appropriate notice.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                8. Platform Availability
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                While we strive to maintain 99.9% uptime, we cannot guarantee uninterrupted access to the platform. We may perform maintenance, updates, or modifications that temporarily affect availability.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                9. Limitation of Liability
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                iRankHub provides the platform &#34;as is&#34; without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform. Our total liability is limited to the amount you have paid us in the preceding 12 months.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                10. Termination
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may suspend or terminate your account for violations of these Terms. You may also delete your account at any time. Upon termination, your access to the platform will cease, but certain provisions of these Terms will survive.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                11. Changes to Terms
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may update these Terms periodically. We will notify users of significant changes via email or platform notifications. Continued use of the platform after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                12. Contact Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  If you have questions about these Terms or need support, please contact us:
                </p>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <p><strong>Email:</strong> infp@debaterwanda.org</p>
                  <p><strong>Address:</strong> Kigali, Rwanda</p>
                  <p><strong>Platform:</strong> Use the in-app support feature for fastest response</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                13. Governing Law
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms are governed by the laws of Rwanda. Any disputes will be resolved through binding arbitration in Kigali, Rwanda, except where prohibited by local law.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <Image
                  src="/images/logo.png"
                  alt="iRankHub Logo"
                  width={24}
                  height={24}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  © {new Date().getFullYear()} iRankHub. All rights reserved.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}