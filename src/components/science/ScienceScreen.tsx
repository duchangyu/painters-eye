export interface ScienceScreenProps {
  readonly onBack: () => void;
}

/**
 * Layered science explainer: each section opens with plain language, then a
 * collapsible block carries the technical detail for readers who want it.
 */
export function ScienceScreen({ onBack }: ScienceScreenProps) {
  return (
    <main className="setup-page science-page">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          PE
        </span>
        <span>看见另一种颜色</span>
      </header>

      <section className="setup-intro" aria-labelledby="science-title">
        <p className="folio">科学原理</p>
        <h1 id="science-title">这套转换是怎么算出来的？</h1>
        <p className="intro-lede">
          四步：测量你的眼睛 → 模拟你看到的颜色 → 把丢失的信息换个通道 →
          实时渲染到画面上。
        </p>
      </section>

      <div className="setup-form">
        <div className="form-section">
          <p className="section-number">01</p>
          <div>
            <h2>先测量，再转换</h2>
            <p>
              你看到的每个圆环都有一个细小的开口。我们不问你「分得清吗」，而是把颜色差异一点点调小，
              找到你「刚好还能看清」的那个临界点——这就是你的辨色阈值。
            </p>
            <details className="science-details">
              <summary>技术细节：自适应阶梯法</summary>
              <p>
                刺激是四方向 Landolt C
                缺口环，叠加随机点阵噪声，几何与颜色由种子复现。测量采用心理物理学的
                2-down-1-up 阶梯法：连续答对两次就把颜色差异调小（更难），答错一次就调大（更易），
                收敛点对应约 70.7% 正确率的阈值。每次方向反转记录当前差异值，并把步长乘以
                0.75——前期大步快收敛，后期小步精定位。最终阈值从反转点拟合，而不是从原始作答序列回放。
              </p>
              <p>
                完整测试跑四条独立阶梯：红轴、绿轴、蓝黄控制轴、明暗控制轴。两条控制轴用来证明
                「你的阈值升高是红绿特异性的，而不是整体状态差」。
              </p>
            </details>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">02</p>
          <div>
            <h2>模拟你眼中的颜色</h2>
            <p>
              有了阈值，我们就能算出：任意一个颜色，在你的眼里会变成什么样。这一步用的是
              Machado 色觉异常模型——一套从视锥细胞生理学推导出来的数学模型，而不是经验猜测。
            </p>
            <details className="science-details">
              <summary>技术细节：Machado 矩阵</summary>
              <p>
                Machado et al.（2009，IEEE
                TVCG）的思想是：红绿色觉异常来自 L/M 视锥细胞光谱响应的偏移或缺失。
                模型用位移后的视锥响应重新推导 LMS 信号映射，折回 RGB
                空间，得到一组 3×3 模拟矩阵。矩阵按严重程度 0.0–1.0 每 0.1
                预计算一档（protan / deutan 各 11 张），数据与 colour-science
                项目的参考数据集交叉校验过。
              </p>
              <p>
                你的严重程度落在两档之间时，对上下两张矩阵逐元素线性插值。整个乘法在<strong>线性
                sRGB</strong> 下进行：先解码 gamma、乘矩阵、再编码回来——因为矩阵是在物理光能量域推导的，
                直接在感知编码的 sRGB 上算会得到错误结果。
              </p>
            </details>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">03</p>
          <div>
            <h2>把丢失的信息换个通道</h2>
            <p>
              红绿对比在你眼里坍缩了，但信息没有消失。我们把这部分丢失的差异，搬到你还敏感的通道上——
              一部分变成明暗差异，一部分变成蓝黄差异。这叫「替代编码」：不是还原颜色，而是换一种你能感知的方式呈现关系。
            </p>
            <details className="science-details">
              <summary>技术细节：OKLab 重编码</summary>
              <p>
                原色和模拟色都转换到 OKLab 感知色彩空间（L = 明度，a = 红绿轴，b =
                蓝黄轴），计算丢失量 lostRedGreen = a<sub>原色</sub> − a<sub>模拟</sub>。
                然后：L′ = L + lostRedGreen × lightnessGain × strength（红绿差异变明暗差异）；
                b′ = b + (lostRedGreen + 0.15 × lostBlueYellow) × chromaGain ×
                strength（搬到蓝黄轴）。a 通道保持不变——用户本来就分不清
                a，增强它没有意义。最后转回 sRGB 并收敛到色域内。
              </p>
            </details>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">04</p>
          <div>
            <h2>参数不是拍的</h2>
            <p>
              增强多少才算「刚刚好」？我们让算法自己搜索：既要让你分得清，又不能让画面变得不像原画。
            </p>
            <details className="science-details">
              <summary>技术细节：带约束的网格搜索</summary>
              <p>
                lightnessGain 和 chromaGain 由网格搜索确定，目标函数是四项的加权和：
                补偿后的颜色对<strong>经过你的缺陷模拟后</strong>分离度要尽可能大（有效性）；
                与原图的 ΔE_OK 不能太大（自然度）；明度偏移超过阈值要罚（不改变画面明暗结构）；
                蓝黄控制颜色对的差异不能掉超过
                5%（不能按下葫芦浮起瓢）。注意有效性那一项是 simulate(compensate(color))
                的嵌套——评估标准是「你视角下的分离度」，而不是正常视角。
              </p>
            </details>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">05</p>
          <div>
            <h2>实时渲染到画面</h2>
            <p>
              一幅画有几百万个像素，逐像素计算太慢。所以我们把整套变换预先算成一张「查色表」，
              交给显卡硬件完成插值——你拖动强度滑块时，画面是实时变化的。
            </p>
            <details className="science-details">
              <summary>技术细节：3D LUT + WebGL</summary>
              <p>
                把 RGB 立方体均匀切成 17×17×17 = 4913 个采样点，每个点跑一遍完整补偿变换，
                存成 3D LUT（查找表）。渲染时 GPU 的 3D
                纹理单元对最近的 8 个格点做硬件三线性插值，每个像素只需要一次纹理采样。
                LUT 永远按 100% 强度烘培，强度滑块是原图与 LUT
                结果之间的混合权重，因此可以从 0% 平滑调到 100%。WebGL 2
                不可用时自动降级到 CPU 渲染器，软件实现同款三线性插值，两条路径数值行为一致。
              </p>
            </details>
          </div>
        </div>

        <div className="setup-action">
          <p>
            最后一句实话：这套方法不能复制正常色觉者的主观颜色体验，也不等于医学诊断。
            个性化配置只有在「你没见过的题目上」盲测通过后才会被保存——我们相信数据，不相信感觉。
          </p>
          <button className="primary-button" type="button" onClick={onBack}>
            返回 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
