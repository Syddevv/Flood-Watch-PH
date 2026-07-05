import { ReportDetailPage } from "@/components/report-detail-page";

type ReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;

  return <ReportDetailPage reportId={id} />;
}
