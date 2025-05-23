"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { Country, State, City } from 'country-state-city'
import { Provinces, Districts, Sectors, Cells, Villages } from 'rwanda'

interface LocationSelectorProps {
    onCountryChange: (country: string) => void
    onProvinceChange: (province: string) => void
    onDistrictChange: (district: string) => void
    onSectorChange?: (sector: string) => void
    onCellChange?: (cell: string) => void
    onVillageChange?: (village: string) => void
    country: string
    province: string
    district: string
    sector?: string
    cell?: string
    village?: string
    countryError?: string
    provinceError?: string
    districtError?: string
    sectorError?: string
    cellError?: string
    villageError?: string
    includeRwandaDetails?: boolean
}

export function LocationSelector({
                                     onCountryChange,
                                     onProvinceChange,
                                     onDistrictChange,
                                     onSectorChange,
                                     onCellChange,
                                     onVillageChange,
                                     country,
                                     province,
                                     district,
                                     sector = "",
                                     cell = "",
                                     village = "",
                                     countryError,
                                     provinceError,
                                     districtError,
                                     sectorError,
                                     cellError,
                                     villageError,
                                     includeRwandaDetails = false
                                 }: LocationSelectorProps) {
    const [countries, setCountries] = useState<any[]>([])
    const [provinces, setProvinces] = useState<any[]>([])
    const [districts, setDistricts] = useState<any[]>([])
    const [sectors, setSectors] = useState<any[]>([])
    const [cells, setCells] = useState<any[]>([])
    const [villages, setVillages] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Load countries using the country-state-city package
        const fetchCountries = async () => {
            try {
                const countryList = Country.getAllCountries()
                setCountries(countryList)
                setLoading(false)
            } catch (error) {
                console.error("Error fetching countries:", error)
                setLoading(false)
            }
        }

        fetchCountries()
    }, [])

    useEffect(() => {
        const fetchProvinces = async () => {
            if (!country) {
                setProvinces([])
                return
            }

            try {
                if (country === "RW" && includeRwandaDetails) {
                    const rwandaProvinces = Provinces().map(name => ({ name, isoCode: name }))
                    setProvinces(rwandaProvinces)
                } else {

                    const stateList = State.getStatesOfCountry(country)
                    setProvinces(stateList)
                }

                onProvinceChange("")
                onDistrictChange("")
                if (onSectorChange) onSectorChange("")
                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching provinces:", error)
            }
        }

        fetchProvinces()
    }, [country, includeRwandaDetails])

    useEffect(() => {

        const fetchDistricts = async () => {
            if (!country || !province) {
                setDistricts([])
                return
            }

            try {
                if (country === "RW" && includeRwandaDetails) {
                    // For Rwanda, use the rwanda package
                    const rwandaDistricts = Districts(province).map(name => ({ name, isoCode: name }))
                    setDistricts(rwandaDistricts)
                } else {

                    const cityList = City.getCitiesOfState(country, province)
                    setDistricts(cityList)
                }

                onDistrictChange("")
                if (onSectorChange) onSectorChange("")
                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching districts:", error)
            }
        }

        fetchDistricts()
    }, [country, province, includeRwandaDetails])

    useEffect(() => {
        const fetchSectors = async () => {
            if (!country || !province || !district || country !== "RW" || !includeRwandaDetails) {
                setSectors([])
                return
            }

            try {
                const rwandaSectors = Sectors(province, district).map(name => ({ name, isoCode: name }))
                setSectors(rwandaSectors)

                if (onSectorChange) onSectorChange("")
                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching sectors:", error)
            }
        }

        fetchSectors()
    }, [country, province, district, includeRwandaDetails])

    useEffect(() => {
        const fetchCells = async () => {
            if (!country || !province || !district || !sector || country !== "RW" || !includeRwandaDetails) {
                setCells([])
                return
            }

            try {
                const rwandaCells = Cells(province, district, sector).map(name => ({ name, isoCode: name }))
                setCells(rwandaCells)

                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching cells:", error)
            }
        }

        fetchCells()
    }, [country, province, district, sector, includeRwandaDetails])

    useEffect(() => {
        const fetchVillages = async () => {
            if (!country || !province || !district || !sector || !cell || country !== "RW" || !includeRwandaDetails) {
                setVillages([])
                return
            }

            try {
                const rwandaVillages = Villages(province, district, sector, cell).map(name => ({ name, isoCode: name }))
                setVillages(rwandaVillages)

                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching villages:", error)
            }
        }

        fetchVillages()
    }, [country, province, district, sector, cell, includeRwandaDetails])

    if (loading) {
        return <div>Loading locations...</div>
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium dark:text-primary-foreground">
                    Country
                </Label>
                <Select
                    value={country}
                    onValueChange={onCountryChange}
                >
                    <SelectTrigger
                        id="country"
                        className={countryError ? "border-destructive" : ""}
                    >
                        <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                        {countries.map((item) => (
                            <SelectItem key={item.isoCode} value={item.isoCode}>
                                {item.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {countryError && (
                    <p className="text-destructive text-xs mt-1">{countryError}</p>
                )}
            </div>
<div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
                <Label htmlFor="province" className="text-sm font-medium dark:text-primary-foreground">
                    {country === "RW" ? "Province" : "State/Province/Region"}
                </Label>
                <Select
                    value={province}
                    onValueChange={onProvinceChange}
                    disabled={!country}
                >
                    <SelectTrigger
                        id="province"
                        className={provinceError ? "border-destructive" : ""}
                    >
                        <SelectValue placeholder={`Select ${country === "RW" ? "province" : "state/province/region"}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {provinces.map((item) => (
                            <SelectItem key={item.isoCode} value={item.isoCode}>
                                {item.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {provinceError && (
                    <p className="text-destructive text-xs mt-1">{provinceError}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="district" className="text-sm font-medium dark:text-primary-foreground">
                    {country === "RW" ? "District" : "City/District"}
                </Label>
                <Select
                    value={district}
                    onValueChange={onDistrictChange}
                    disabled={!province}
                >
                    <SelectTrigger
                        id="district"
                        className={districtError ? "border-destructive" : ""}
                    >
                        <SelectValue placeholder={`Select ${country === "RW" ? "district" : "city/district"}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {districts.map((item) => (
                            <SelectItem key={item.isoCode} value={item.isoCode}>
                                {item.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {districtError && (
                    <p className="text-destructive text-xs mt-1">{districtError}</p>
                )}
            </div>
</div>
            {country === "RW" && includeRwandaDetails && (
                <>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                        <Label htmlFor="sector" className="text-sm font-medium dark:text-primary-foreground">
                            Sector
                        </Label>
                        <Select
                            value={sector}
                            onValueChange={(value) => onSectorChange?.(value)}
                            disabled={!district}
                        >
                            <SelectTrigger
                                id="sector"
                                className={sectorError ? "border-destructive" : ""}
                            >
                                <SelectValue placeholder="Select sector" />
                            </SelectTrigger>
                            <SelectContent>
                                {sectors.map((item) => (
                                    <SelectItem key={item.isoCode} value={item.isoCode}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {sectorError && (
                            <p className="text-destructive text-xs mt-1">{sectorError}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cell" className="text-sm font-medium dark:text-primary-foreground">
                            Cell
                        </Label>
                        <Select
                            value={cell}
                            onValueChange={(value) => onCellChange?.(value)}
                            disabled={!sector}
                        >
                            <SelectTrigger
                                id="cell"
                                className={cellError ? "border-destructive" : ""}
                            >
                                <SelectValue placeholder="Select cell" />
                            </SelectTrigger>
                            <SelectContent>
                                {cells.map((item) => (
                                    <SelectItem key={item.isoCode} value={item.isoCode}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {cellError && (
                            <p className="text-destructive text-xs mt-1">{cellError}</p>
                        )}
                    </div>
                </div>

                    <div className="space-y-2">
                        <Label htmlFor="village" className="text-sm font-medium dark:text-primary-foreground">
                            Village
                        </Label>
                        <Select
                            value={village}
                            onValueChange={(value) => onVillageChange?.(value)}
                            disabled={!cell}
                        >
                            <SelectTrigger
                                id="village"
                                className={villageError ? "border-destructive" : ""}
                            >
                                <SelectValue placeholder="Select village" />
                            </SelectTrigger>
                            <SelectContent>
                                {villages.map((item) => (
                                    <SelectItem key={item.isoCode} value={item.isoCode}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {villageError && (
                            <p className="text-destructive text-xs mt-1">{villageError}</p>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}