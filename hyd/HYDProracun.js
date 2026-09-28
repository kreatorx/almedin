/**
 * HYDProracun.js
 * Samostalni modul za hidraulički proračun cjevovoda pod pritiskom.
 */
class HYDProracun {
    constructor(options = {}) {
        this.g = options.g || 9.81;
        this.nu = options.nu || 1.004e-6;
        this.defaultRoughness = options.defaultRoughness || 0.00001; 
    }

    /**
     * Pomoćna metoda za određivanje kote cijevi uzimajući u obzir nodeRef.depth
     */
    _getZPipe(node) {
        if (node.zPipe !== undefined) return node.zPipe;
        const depth = node.nodeRef?.depth !== undefined ? node.nodeRef.depth : 0.80;
        return node.z - depth;
    }

    /**
     * Pomoćna metoda za određivanje unutrašnjeg prečnika cijevi u metrima
     */
    _getIntDiameter(node) {
        if (node.D_int !== undefined) return node.D_int;
        const pInfo = node.nodeRef?.pipeSegment || { diameter: 110, wallThickness: 6.6 };
        const D_ext_m = (node.D || pInfo.diameter || 110) / 1000.0;
        const t_m = (pInfo.wallThickness !== undefined ? pInfo.wallThickness : 6.6) / 1000.0;
        return Math.max(0.01, D_ext_m - 2 * t_m);
    }

    /**
     * Proračun gravitacionog protoka sa dinamičkom prelivnom visinom h_pr = h_offset + t_m
     */
    solveGravityFlow(sampledNodes, H_start, H_end, valveMult = 1.0, waterLevel = 1.0, h_offset = 0.05) {
        if (!sampledNodes || sampledNodes.length < 2) return { Q_lps: 0, isPartiallyFilled: false };

        const deltaH = H_start - H_end;
        if (deltaH <= 0.001 || valveMult <= 0) return { Q_lps: 0, isPartiallyFilled: false };

        const D_int_m = this._getIntDiameter(sampledNodes[0]);
        const pipeInfo = sampledNodes[0].nodeRef ? sampledNodes[0].nodeRef.pipeSegment : { wallThickness: 6.6 };
        const t_m = (pipeInfo.wallThickness !== undefined ? pipeInfo.wallThickness : 6.6) / 1000.0;

        // 1. Prelivna visina (donja unutrašnja ivica cijevi preko koje preliva voda)
        const h_pr = h_offset + t_m; 

        // Nivo vode mora preći prelivnu visinu da bi započelo isticanje
        const h_eff = Math.max(0.0, waterLevel - h_pr);
        if (h_eff <= 0) return { Q_lps: 0, isPartiallyFilled: false };

        // Djelimično ispunjena cijev dok nivo ne pređe gornju ivicu (potopljeni ulaz)
        const isPartiallyFilled = waterLevel < (h_pr + D_int_m);
        const fillRatio = isPartiallyFilled ? Math.pow(h_eff / D_int_m, 1.5) : 1.0;

        let sumResistance = 0;
        for (let i = 1; i < sampledNodes.length; i++) {
            const prev = sampledNodes[i - 1];
            const curr = sampledNodes[i];
            const L_i = Math.max(0.1, curr.station - prev.station);

            const D_i = this._getIntDiameter(prev);
            const pInfo = prev.nodeRef ? prev.nodeRef.pipeSegment : { roughness: 0.01 };
            const k_i = Math.max(0.00001, (pInfo.roughness || 0.01) / 1000.0);
            const A_i = (Math.PI * D_i * D_i) / 4.0;

            const f_i = 0.25 / Math.pow(Math.log10(k_i / (3.7 * D_i) + 5.74 / Math.pow(1e5, 0.9)), 2);
            sumResistance += (f_i * (L_i / D_i)) / (A_i * A_i);

            const zeta_j = curr.nodeRef ? (curr.nodeRef.zeta || 0) : 0;
            if (zeta_j > 0) sumResistance += zeta_j / (A_i * A_i);
        }

        const A_last = (Math.PI * D_int_m * D_int_m) / 4.0;
        sumResistance += 1.0 / (A_last * A_last);

        if (sumResistance <= 0) return { Q_lps: 0, isPartiallyFilled: false };

        const Q_m3s = Math.sqrt((2.0 * this.g * deltaH) / sumResistance) * valveMult * fillRatio;
        return { Q_lps: Q_m3s * 1000.0, isPartiallyFilled: isPartiallyFilled };
    }

    calculateProfile(nodes, Q, H0) {
        if (!nodes || nodes.length < 2) return { error: "Nedovoljno čvorova.", profile: [] };

        const profileResults = [];
        let currentHGL = H0;
        const isClosed = Q <= 0.00001;

        const D_int0 = this._getIntDiameter(nodes[0]);
        const area0 = (Math.PI * Math.pow(D_int0, 2)) / 4;
        const v0 = isClosed ? 0 : Q / area0;
        const hv0 = Math.pow(v0, 2) / (2 * this.g);
        const zP0 = this._getZPipe(nodes[0]);

        profileResults.push({
            station: nodes[0].station, 
            zTerrain: nodes[0].z, 
            zPipe: zP0,
            hgl: currentHGL, 
            egl: currentHGL + hv0, 
            velocity: v0,
            pressureHead: currentHGL - zP0, 
            pressureBar: (currentHGL - zP0) / 10.197,
            frictionLoss: 0, 
            minorLoss: 0, 
            f: 0, 
            Re: isClosed ? 0 : (v0 * D_int0) / this.nu
        });

        for (let i = 1; i < nodes.length; i++) {
            const prevNode = nodes[i - 1];
            const currNode = nodes[i];
            const L = currNode.station - prevNode.station;

            const D_int = this._getIntDiameter(prevNode);
            const k = currNode.k || (prevNode.nodeRef?.pipeSegment?.roughness ? prevNode.nodeRef.pipeSegment.roughness / 1000 : this.defaultRoughness);

            const area = (Math.PI * Math.pow(D_int, 2)) / 4;
            const v = isClosed ? 0 : Q / area;
            const velocityHead = Math.pow(v, 2) / (2 * this.g);
            const Re = isClosed ? 0 : (v * D_int) / this.nu;

            const f = isClosed ? 0 : this.calculateFrictionFactor(v, D_int, k);
            const hf = (f * (L / D_int)) * velocityHead;

            let zetaSum = currNode.nodeRef ? (currNode.nodeRef.zeta || 0) : 0;
            if (currNode.fittings && Array.isArray(currNode.fittings)) {
                zetaSum += currNode.fittings.reduce((sum, item) => sum + (item.zeta || 0), 0);
            }
            const hm = zetaSum * velocityHead;

            currentHGL -= (hf + hm);
            const zP = this._getZPipe(currNode);
            const pHead = currentHGL - zP;

            profileResults.push({
                station: currNode.station, 
                zTerrain: currNode.z, 
                zPipe: zP,
                hgl: currentHGL, 
                egl: currentHGL + velocityHead, 
                velocity: v,
                pressureHead: pHead, 
                pressureBar: pHead / 10.197,
                frictionLoss: hf, 
                minorLoss: hm, 
                f: f, 
                Re: Re
            });
        }

        return {
            summary: {
                totalLength: nodes[nodes.length - 1].station - nodes[0].station,
                flowRateLps: Q * 1000, 
                initialHGL: H0, 
                finalHGL: currentHGL,
                totalHeadLoss: H0 - currentHGL,
                minPressureBar: Math.min(...profileResults.map(p => p.pressureBar)),
                maxPressureBar: Math.max(...profileResults.map(p => p.pressureBar))
            },
            profile: profileResults
        };
    }

    calculateFrictionFactor(v, D, k) {
        if (v === 0) return 0;
        const Re = (v * D) / this.nu;
        if (Re < 2300) return 64 / Re;
        const term1 = k / (3.7 * D);
        const term2 = 5.74 / Math.pow(Re, 0.9);
        return 0.25 / Math.pow(Math.log10(term1 + term2), 2);
    }
}
const hydEngine = new HYDProracun();
