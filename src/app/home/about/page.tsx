"use client";
import { IwFoot, IwNav, Logo } from "@/components/Intranet";

export default function AboutPage() {
  return (
    <div className="home">
      <IwNav page="about" />
      <div className="iw-wrap" style={{ minHeight: "calc(100vh - 320px)" }}>
        <div className="iw-ptitle" style={{ textAlign: "center", borderBottom: "2px solid #b9d2ea" }}>
          About Us
        </div>
        <div className="iw-about">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Logo size={110} />
          </div>
          <h2>Revomed Group — Innovative Revolution</h2>
          <p>
            ผู้ผลิตและพัฒนาเครื่องสำอาง เวชสำอาง อาหารเสริม และเครื่องดื่มฟังก์ชันแบบครบวงจร (OEM / ODM)
            ตั้งแต่การพัฒนาสูตร วิจัย ขึ้นทะเบียน ออกแบบบรรจุภัณฑ์ ไปจนถึงการผลิตในโรงงานมาตรฐาน GMP
            เราเชื่อในคุณภาพ ความโปร่งใส และการส่งมอบตรงเวลา
          </p>
          <div className="iw-about-grid">
            <div className="iw-about-card">
              <h5>Vision</h5>
              <div>เป็นพาร์ทเนอร์การผลิตอันดับหนึ่งที่แบรนด์ความงามและสุขภาพไว้วางใจมากที่สุดในภูมิภาค</div>
            </div>
            <div className="iw-about-card">
              <h5>Mission</h5>
              <div>พัฒนาสูตรและผลิตสินค้าคุณภาพสูง ด้วยกระบวนการที่ตรวจสอบได้ทุกขั้นตอน ผ่านระบบ OMS ของเราเอง</div>
            </div>
            <div className="iw-about-card">
              <h5>Core Values</h5>
              <div>Quality First · Transparency · On-time Delivery · Innovation · ทีมเวิร์คแบบพี่น้อง</div>
            </div>
          </div>
        </div>
      </div>
      <IwFoot />
    </div>
  );
}
