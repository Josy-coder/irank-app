"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

import { Country, State, City } from 'country-state-city'
import { Provinces, Districts, Sectors, Cells, Villages } from 'rwanda'

interface LocationOption {
  value: string
  label: string
}

interface SelectedLocations {
  countries: string[]
  provinces: string[]
  districts: string[]
  sectors: string[]
  cells: string[]
  villages: string[]
}

interface SimpleLocationMultiSelectorProps {
  selectedLocations: SelectedLocations
  onLocationsChange: (locations: SelectedLocations) => void
  includeRwandaDetails?: boolean
  className?: string
  leagueType?: "Local" | "International" | "Dreams Mode"
}

interface MultiSelectFieldProps {
  label: string
  placeholder: string
  options: LocationOption[]
  selected: string[]
  onSelectionChange: (selected: string[]) => void
  disabled?: boolean
  loading?: boolean
}

function MultiSelectField({
                            label,
                            placeholder,
                            options,
                            selected,
                            onSelectionChange,
                            disabled = false,
                            loading = false
                          }: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredOptions = useMemo(() => {
    if (!searchValue) return options
    return options.filter(option =>
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const selectedOptions = useMemo(() => {
    return selected
      .map(value => options.find(option => option.value === value))
      .filter(Boolean) as LocationOption[]
  }, [selected, options])

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(s => s !== value))
    } else {
      onSelectionChange([...selected, value])
    }
  }

  const handleRemove = (value: string) => {
    onSelectionChange(selected.filter(s => s !== value))
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || options.length === 0}
            className="w-full justify-between min-h-[40px] h-auto py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="text-xs"
                  >
                    {option.label}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-3 w-3 p-0 ml-1 hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(option.value)
                      }}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">
                  {disabled ? "Select parent level first" : placeholder}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedOptions.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearAll()
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandList className="max-h-[200px]">
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const isSelected = selected.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedOptions.length} selected
        </div>
      )}
    </div>
  )
}

export function SimpleLocationMultiSelector({
                                              selectedLocations,
                                              onLocationsChange,
                                              includeRwandaDetails = true,
                                              className,
                                              leagueType
                                            }: SimpleLocationMultiSelectorProps) {
  const [loading, setLoading] = useState(true)
  const [countries, setCountries] = useState<LocationOption[]>([])
  const [provinces, setProvinces] = useState<LocationOption[]>([])
  const [districts, setDistricts] = useState<LocationOption[]>([])
  const [sectors, setSectors] = useState<LocationOption[]>([])
  const [cells, setCells] = useState<LocationOption[]>([])
  const [villages, setVillages] = useState<LocationOption[]>([])

  useEffect(() => {
    const loadCountries = () => {
      try {
        if (leagueType === "Local") {
          const rwandaCountry = Country.getCountryByCode("RW")
          if (rwandaCountry) {
            setCountries([{ value: "RW", label: rwandaCountry.name }])
            if (selectedLocations.countries.length === 0) {
              onLocationsChange({
                ...selectedLocations,
                countries: ["RW"]
              })
            }
          }
        } else {
          const countryData = Country.getAllCountries().map(country => ({
            value: country.isoCode,
            label: country.name
          }))
          setCountries(countryData)
        }
      } catch (error) {
        console.error("Error loading countries:", error)
      } finally {
        setLoading(false)
      }
    }
    loadCountries()
  }, [leagueType])

  useEffect(() => {
    if (selectedLocations.countries.length === 0) {
      setProvinces([])
      return
    }

    const loadProvinces = async () => {
      try {
        const provinceData: LocationOption[] = []

        for (const countryCode of selectedLocations.countries) {
          if (countryCode === "RW" && includeRwandaDetails) {
            const rwandaProvinces = Provinces().map(name => ({
              value: `${countryCode}-${name}`,
              label: name
            }))
            provinceData.push(...rwandaProvinces)
          } else {
            const states = State.getStatesOfCountry(countryCode)
            const stateData = states.map(state => ({
              value: `${countryCode}-${state.isoCode}`,
              label: state.name
            }))
            provinceData.push(...stateData)
          }
        }

        const uniqueProvinces = provinceData.filter((item, index, self) =>
          index === self.findIndex(t => t.value === item.value)
        ).sort((a, b) => a.label.localeCompare(b.label))

        setProvinces(uniqueProvinces)

        const validProvinces = uniqueProvinces.map(p => p.value)
        const filteredSelectedProvinces = selectedLocations.provinces.filter(p =>
          validProvinces.includes(p)
        )

        if (filteredSelectedProvinces.length !== selectedLocations.provinces.length) {
          onLocationsChange({
            ...selectedLocations,
            provinces: filteredSelectedProvinces,
            districts: [],
            sectors: [],
            cells: [],
            villages: []
          })
        }
      } catch (error) {
        console.error("Error loading provinces:", error)
      }
    }

    loadProvinces()
  }, [selectedLocations.countries, includeRwandaDetails])

  useEffect(() => {
    if (selectedLocations.provinces.length === 0) {
      setDistricts([])
      return
    }

    const loadDistricts = async () => {
      try {
        const districtData: LocationOption[] = []

        for (const provinceValue of selectedLocations.provinces) {
          const [countryCode, ...provinceParts] = provinceValue.split('-')
          const province = provinceParts.join('-')

          if (countryCode === "RW" && includeRwandaDetails) {
            const rwandaDistricts = Districts(province).map(name => ({
              value: `${provinceValue}-${name}`,
              label: name
            }))
            districtData.push(...rwandaDistricts)
          } else {
            const cities = City.getCitiesOfState(countryCode, province)
            const cityData = cities.map(city => ({
              value: `${provinceValue}-${city.name}`,
              label: city.name
            }))
            districtData.push(...cityData)
          }
        }

        const uniqueDistricts = districtData.filter((item, index, self) =>
          index === self.findIndex(t => t.value === item.value)
        ).sort((a, b) => a.label.localeCompare(b.label))

        setDistricts(uniqueDistricts)

        const validDistricts = uniqueDistricts.map(d => d.value)
        const filteredSelectedDistricts = selectedLocations.districts.filter(d =>
          validDistricts.includes(d)
        )

        if (filteredSelectedDistricts.length !== selectedLocations.districts.length) {
          onLocationsChange({
            ...selectedLocations,
            districts: filteredSelectedDistricts,
            sectors: [],
            cells: [],
            villages: []
          })
        }
      } catch (error) {
        console.error("Error loading districts:", error)
      }
    }

    loadDistricts()
  }, [selectedLocations.provinces, includeRwandaDetails])

  useEffect(() => {
    if (selectedLocations.districts.length === 0 || !includeRwandaDetails) {
      setSectors([])
      return
    }

    const loadSectors = async () => {
      try {
        const sectorData: LocationOption[] = []

        for (const districtValue of selectedLocations.districts) {
          const parts = districtValue.split('-')
          if (parts[0] === "RW" && parts.length >= 3) {
            const province = parts[1]
            const district = parts[2]

            const rwandaSectors = Sectors(province, district).map(name => ({
              value: `${districtValue}-${name}`,
              label: name
            }))
            sectorData.push(...rwandaSectors)
          }
        }

        const uniqueSectors = sectorData.filter((item, index, self) =>
          index === self.findIndex(t => t.value === item.value)
        ).sort((a, b) => a.label.localeCompare(b.label))

        setSectors(uniqueSectors)

        const validSectors = uniqueSectors.map(s => s.value)
        const filteredSelectedSectors = selectedLocations.sectors.filter(s =>
          validSectors.includes(s)
        )

        if (filteredSelectedSectors.length !== selectedLocations.sectors.length) {
          onLocationsChange({
            ...selectedLocations,
            sectors: filteredSelectedSectors,
            cells: [],
            villages: []
          })
        }
      } catch (error) {
        console.error("Error loading sectors:", error)
      }
    }

    loadSectors()
  }, [selectedLocations.districts, includeRwandaDetails])

  useEffect(() => {
    if (selectedLocations.sectors.length === 0 || !includeRwandaDetails) {
      setCells([])
      return
    }

    const loadCells = async () => {
      try {
        const cellData: LocationOption[] = []

        for (const sectorValue of selectedLocations.sectors) {
          const parts = sectorValue.split('-')
          if (parts[0] === "RW" && parts.length >= 4) {
            const province = parts[1]
            const district = parts[2]
            const sector = parts[3]

            const rwandaCells = Cells(province, district, sector).map(name => ({
              value: `${sectorValue}-${name}`,
              label: name
            }))
            cellData.push(...rwandaCells)
          }
        }

        const uniqueCells = cellData.filter((item, index, self) =>
          index === self.findIndex(t => t.value === item.value)
        ).sort((a, b) => a.label.localeCompare(b.label))

        setCells(uniqueCells)

        const validCells = uniqueCells.map(c => c.value)
        const filteredSelectedCells = selectedLocations.cells.filter(c =>
          validCells.includes(c)
        )

        if (filteredSelectedCells.length !== selectedLocations.cells.length) {
          onLocationsChange({
            ...selectedLocations,
            cells: filteredSelectedCells,
            villages: []
          })
        }
      } catch (error) {
        console.error("Error loading cells:", error)
      }
    }

    loadCells()
  }, [selectedLocations.sectors, includeRwandaDetails])

  // Load villages when cells change (Rwanda only)
  useEffect(() => {
    if (selectedLocations.cells.length === 0 || !includeRwandaDetails) {
      setVillages([])
      return
    }

    const loadVillages = async () => {
      try {
        const villageData: LocationOption[] = []

        for (const cellValue of selectedLocations.cells) {
          const parts = cellValue.split('-')
          if (parts[0] === "RW" && parts.length >= 5) {
            const province = parts[1]
            const district = parts[2]
            const sector = parts[3]
            const cell = parts[4]

            const rwandaVillages = Villages(province, district, sector, cell).map(name => ({
              value: `${cellValue}-${name}`,
              label: name
            }))
            villageData.push(...rwandaVillages)
          }
        }

        const uniqueVillages = villageData.filter((item, index, self) =>
          index === self.findIndex(t => t.value === item.value)
        ).sort((a, b) => a.label.localeCompare(b.label))

        setVillages(uniqueVillages)

        const validVillages = uniqueVillages.map(v => v.value)
        const filteredSelectedVillages = selectedLocations.villages.filter(v =>
          validVillages.includes(v)
        )

        if (filteredSelectedVillages.length !== selectedLocations.villages.length) {
          onLocationsChange({
            ...selectedLocations,
            villages: filteredSelectedVillages
          })
        }
      } catch (error) {
        console.error("Error loading villages:", error)
      }
    }

    loadVillages()
  }, [selectedLocations.cells, includeRwandaDetails])

  const isRwandaSelected = selectedLocations.countries.includes("RW")

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4">
        <MultiSelectField
          label="Countries *"
          placeholder="Select countries"
          options={countries}
          selected={selectedLocations.countries}
          onSelectionChange={(countries) => onLocationsChange({
            countries,
            provinces: [],
            districts: [],
            sectors: [],
            cells: [],
            villages: []
          })}
          loading={loading}
          disabled={leagueType === "Local"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MultiSelectField
          label={isRwandaSelected ? "Provinces" : "States/Provinces"}
          placeholder={`Select ${isRwandaSelected ? "provinces" : "states/provinces"}`}
          options={provinces}
          selected={selectedLocations.provinces}
          onSelectionChange={(provinces) => onLocationsChange({
            ...selectedLocations,
            provinces,
            districts: [],
            sectors: [],
            cells: [],
            villages: []
          })}
          disabled={selectedLocations.countries.length === 0}
        />

        <MultiSelectField
          label={isRwandaSelected ? "Districts" : "Cities"}
          placeholder={`Select ${isRwandaSelected ? "districts" : "cities"}`}
          options={districts}
          selected={selectedLocations.districts}
          onSelectionChange={(districts) => onLocationsChange({
            ...selectedLocations,
            districts,
            sectors: [],
            cells: [],
            villages: []
          })}
          disabled={selectedLocations.provinces.length === 0}
        />
      </div>

      {isRwandaSelected && includeRwandaDetails && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MultiSelectField
              label="Sectors (Optional)"
              placeholder="Select sectors"
              options={sectors}
              selected={selectedLocations.sectors}
              onSelectionChange={(sectors) => onLocationsChange({
                ...selectedLocations,
                sectors,
                cells: [],
                villages: []
              })}
              disabled={selectedLocations.districts.length === 0}
            />

            <MultiSelectField
              label="Cells (Optional)"
              placeholder="Select cells"
              options={cells}
              selected={selectedLocations.cells}
              onSelectionChange={(cells) => onLocationsChange({
                ...selectedLocations,
                cells,
                villages: []
              })}
              disabled={selectedLocations.sectors.length === 0}
            />
          </div>

          <MultiSelectField
            label="Villages (Optional)"
            placeholder="Select villages"
            options={villages}
            selected={selectedLocations.villages}
            onSelectionChange={(villages) => onLocationsChange({
              ...selectedLocations,
              villages
            })}
            disabled={selectedLocations.cells.length === 0}
          />
        </>
      )}
    </div>
  )
}