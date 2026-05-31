import GeneralInfo from '@/components/GeneralInfo';

export const metadata = {
  title: 'Info - SchoolPuls',
  description: 'General information, vendor details, and uniform rules for Class 1.',
};

export default function InfoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <GeneralInfo />
    </div>
  );
}
