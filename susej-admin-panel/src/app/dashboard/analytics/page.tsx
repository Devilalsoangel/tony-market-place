"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { mockRevenueData, mockGrowthData, mockTopCategories } from "@/services/mock-data";

const dailyActiveUsers = [
  { name: "Mon", value: 4200 },
  { name: "Tue", value: 4800 },
  { name: "Wed", value: 5100 },
  { name: "Thu", value: 4900 },
  { name: "Fri", value: 5600 },
  { name: "Sat", value: 6200 },
  { name: "Sun", value: 5800 },
];

const topSearches = [
  { name: "Wireless headphones", value: 12500 },
  { name: "Cotton t-shirt", value: 9800 },
  { name: "Smart watch", value: 8700 },
  { name: "Running shoes", value: 7600 },
  { name: "Leather wallet", value: 6500 },
];

const conversionData = [
  { name: "Jan", value: 2.1 },
  { name: "Feb", value: 2.3 },
  { name: "Mar", value: 2.0 },
  { name: "Apr", value: 2.5 },
  { name: "May", value: 2.7 },
  { name: "Jun", value: 3.1 },
];

const ordersTrend = [
  { name: "Jan", value: 3200 },
  { name: "Feb", value: 3800 },
  { name: "Mar", value: 3500 },
  { name: "Apr", value: 4200 },
  { name: "May", value: 4800 },
  { name: "Jun", value: 5600 },
];

const productsGrowth = [
  { name: "Jan", value: 32000 },
  { name: "Feb", value: 36000 },
  { name: "Mar", value: 39000 },
  { name: "Apr", value: 44000 },
  { name: "May", value: 49000 },
  { name: "Jun", value: 56200 },
];

const communitiesGrowth = [
  { name: "Jan", value: 680 },
  { name: "Feb", value: 750 },
  { name: "Mar", value: 820 },
  { name: "Apr", value: 950 },
  { name: "May", value: 1100 },
  { name: "Jun", value: 1250 },
];

const topSellers = [
  { name: "TechStore", value: 125000 },
  { name: "FashionHub", value: 98000 },
  { name: "HomeGoods", value: 72000 },
  { name: "FreshMart", value: 54000 },
  { name: "BookWorld", value: 38000 },
];

const topProducts = [
  { name: "Wireless Headphones", value: 28500 },
  { name: "Cotton T-Shirt", value: 19200 },
  { name: "Smart Watch", value: 15800 },
  { name: "Running Shoes", value: 12400 },
  { name: "Leather Wallet", value: 9800 },
];

const topCities = [
  { name: "Mumbai", value: 5200 },
  { name: "Delhi", value: 4800 },
  { name: "Bangalore", value: 3800 },
  { name: "Hyderabad", value: 2100 },
  { name: "Chennai", value: 1800 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">In-depth platform analytics and metrics</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={mockRevenueData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>User & Seller Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={mockGrowthData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={ordersTrend} height={250} color="#6C3BFF" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Products Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={productsGrowth} height={250} color="#16A34A" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Communities Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={communitiesGrowth} height={250} color="#2563EB" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={dailyActiveUsers} height={250} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={topSellers} height={250} color="#F59E0B" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={topProducts} height={250} color="#16A34A" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={topCities} height={250} color="#2563EB" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={mockTopCategories} height={250} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={topSearches} height={250} color="#16A34A" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={conversionData} height={250} color="#2563EB" />
          </CardContent>
        </Card>
      </div>


    </div>
  );
}
