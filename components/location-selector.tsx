"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

import { Country, State, City } from 'country-state-city'
import { Provinces, Districts, Sectors, Cells, Villages } from 'rwanda'
import { Skeleton } from "@/components/ui/skeleton"

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

interface LocationItem {
    name: string
    isoCode: string
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
    const [countries, setCountries] = useState<LocationItem[]>([])
    const [provinces, setProvinces] = useState<LocationItem[]>([])
    const [districts, setDistricts] = useState<LocationItem[]>([])
    const [sectors, setSectors] = useState<LocationItem[]>([])
    const [cells, setCells] = useState<LocationItem[]>([])
    const [villages, setVillages] = useState<LocationItem[]>([])
    const [loading, setLoading] = useState(true)

    const [customCity, setCustomCity] = useState("")
    const [showCustomCity, setShowCustomCity] = useState(false)

    const [countryOpen, setCountryOpen] = useState(false)
    const [provinceOpen, setProvinceOpen] = useState(false)
    const [districtOpen, setDistrictOpen] = useState(false)
    const [sectorOpen, setSectorOpen] = useState(false)
    const [cellOpen, setCellOpen] = useState(false)
    const [villageOpen, setVillageOpen] = useState(false)

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const countryList = Country.getAllCountries().map(c => ({
                    name: c.name,
                    isoCode: c.isoCode
                }))
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
                let provinceList: LocationItem[]

                if (country === "RW" && includeRwandaDetails) {
                    provinceList = Provinces().map(name => ({ name, isoCode: name }))
                } else {
                    const stateList = State.getStatesOfCountry(country)
                    provinceList = stateList.map(s => ({ name: s.name, isoCode: s.isoCode }))
                }

                setProvinces(provinceList)

                onProvinceChange("")
                onDistrictChange("")
                if (onSectorChange) onSectorChange("")
                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
                setCustomCity("")
                setShowCustomCity(false)
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
                setShowCustomCity(false)
                return
            }

            try {
                let districtList: LocationItem[]

                if (country === "RW" && includeRwandaDetails) {
                    districtList = Districts(province).map(name => ({ name, isoCode: name }))
                } else {
                    const cityList = City.getCitiesOfState(country, province)
                    districtList = cityList.map(c => ({ name: c.name, isoCode: c.name }))
                }

                setDistricts(districtList)

                if (districtList.length === 0 && country !== "RW") {
                    setShowCustomCity(true)
                } else {
                    setShowCustomCity(false)
                }

                onDistrictChange("")
                if (onSectorChange) onSectorChange("")
                if (onCellChange) onCellChange("")
                if (onVillageChange) onVillageChange("")
                setCustomCity("")
            } catch (error) {
                console.error("Error fetching districts:", error)
                setShowCustomCity(true) // Show custom input on error
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
                const sectorList = Sectors(province, district).map(name => ({ name, isoCode: name }))
                setSectors(sectorList)

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
                const cellList = Cells(province, district, sector).map(name => ({ name, isoCode: name }))
                setCells(cellList)

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
                const villageList = Villages(province, district, sector, cell).map(name => ({ name, isoCode: name }))
                setVillages(villageList)

                if (onVillageChange) onVillageChange("")
            } catch (error) {
                console.error("Error fetching villages:", error)
            }
        }

        fetchVillages()
    }, [country, province, district, sector, cell, includeRwandaDetails])

    const handleCustomCityChange = (value: string) => {
        setCustomCity(value)
        onDistrictChange(value)
    }

    const SearchableSelect = ({
                                  value,
                                  onValueChange,
                                  placeholder,
                                  items,
                                  open,
                                  onOpenChange,
                                  error,
                                  disabled = false
                              }: {
        value: string
        onValueChange: (value: string) => void
        placeholder: string
        items: LocationItem[]
        open: boolean
        onOpenChange: (open: boolean) => void
        error?: string
        disabled?: boolean
    }) => (
      <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  "w-full justify-between",
                  error && "border-destructive",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                disabled={disabled}
              >
                    <span className="truncate">
                        {value ? items.find(item => item.isoCode === value)?.name || value : placeholder}
                    </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
              <Command>
                  <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
                  <CommandEmpty>No {placeholder.toLowerCase()} found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                      {items.map((item) => (
                        <CommandItem
                          key={item.isoCode}
                          value={item.name}
                          onSelect={() => {
                              onValueChange(item.isoCode)
                              onOpenChange(false)
                          }}
                        >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                value === item.isoCode ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {item.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
              </Command>
          </PopoverContent>
      </Popover>
    )

    if (loading) {
        return (
          <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
          </div>
        );
    }


    return (
      <div className="space-y-4">
          <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium dark:text-primary-foreground">
                  Country
              </Label>
              <SearchableSelect
                value={country}
                onValueChange={onCountryChange}
                placeholder="Select country"
                items={countries}
                open={countryOpen}
                onOpenChange={setCountryOpen}
                error={countryError}
              />
              {countryError && (
                <p className="text-destructive text-xs mt-1">{countryError}</p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                  <Label htmlFor="province" className="text-sm font-medium dark:text-primary-foreground">
                      {country === "RW" ? "Province" : "State/Province/Region"}
                  </Label>
                  <SearchableSelect
                    value={province}
                    onValueChange={onProvinceChange}
                    placeholder={`Select ${country === "RW" ? "province" : "state/province/region"}`}
                    items={provinces}
                    open={provinceOpen}
                    onOpenChange={setProvinceOpen}
                    error={provinceError}
                    disabled={!country}
                  />
                  {provinceError && (
                    <p className="text-destructive text-xs mt-1">{provinceError}</p>
                  )}
              </div>

              <div className="space-y-2">
                  <Label htmlFor="district" className="text-sm font-medium dark:text-primary-foreground">
                      {country === "RW" ? "District" : "City/District"}
                  </Label>
                  {showCustomCity ? (
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Enter city name"
                          value={customCity}
                          onChange={(e) => handleCustomCityChange(e.target.value)}
                          className={cn("pl-10", districtError && "border-destructive")}
                          disabled={!province}
                        />
                    </div>
                  ) : (
                    <SearchableSelect
                      value={district}
                      onValueChange={onDistrictChange}
                      placeholder={`Select ${country === "RW" ? "district" : "city/district"}`}
                      items={districts}
                      open={districtOpen}
                      onOpenChange={setDistrictOpen}
                      error={districtError}
                      disabled={!province}
                    />
                  )}
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
                        <SearchableSelect
                          value={sector || ""}
                          onValueChange={(value) => onSectorChange?.(value)}
                          placeholder="Select sector"
                          items={sectors}
                          open={sectorOpen}
                          onOpenChange={setSectorOpen}
                          error={sectorError}
                          disabled={!district}
                        />
                        {sectorError && (
                          <p className="text-destructive text-xs mt-1">{sectorError}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cell" className="text-sm font-medium dark:text-primary-foreground">
                            Cell
                        </Label>
                        <SearchableSelect
                          value={cell || ""}
                          onValueChange={(value) => onCellChange?.(value)}
                          placeholder="Select cell"
                          items={cells}
                          open={cellOpen}
                          onOpenChange={setCellOpen}
                          error={cellError}
                          disabled={!sector}
                        />
                        {cellError && (
                          <p className="text-destructive text-xs mt-1">{cellError}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="village" className="text-sm font-medium dark:text-primary-foreground">
                        Village
                    </Label>
                    <SearchableSelect
                      value={village || ""}
                      onValueChange={(value) => onVillageChange?.(value)}
                      placeholder="Select village"
                      items={villages}
                      open={villageOpen}
                      onOpenChange={setVillageOpen}
                      error={villageError}
                      disabled={!cell}
                    />
                    {villageError && (
                      <p className="text-destructive text-xs mt-1">{villageError}</p>
                    )}
                </div>
            </>
          )}
      </div>
    )
}